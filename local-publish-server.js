import http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';

const HOST = '127.0.0.1';
const PORT = 4546;
const ROOT_DIR = process.cwd();
const ENV_FILE = path.join(ROOT_DIR, '.env');
const GROUPS_FILE = path.join(ROOT_DIR, 'groups.json');
const LANDING_PAGE_URL = 'https://israel-jobs-center2026.netlify.app/';
const DEFAULT_GROUP_IMAGE_PATH = path.join(
  ROOT_DIR,
  'assets',
  'ChatGPT_Image_Jun_18_2026_10_19_30_PM.png'
);
const VALID_REGIONS = new Set(['north', 'south', 'center', 'sharon', 'jerusalem', 'all']);
const VALID_LAPS = new Set(['lap1', 'lap2', 'lap3', 'lap4', 'all']);
const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/localhost:\d+$/,
  /^https:\/\/israel-jobs-center2026\.netlify\.app$/
];

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  const pathname = getRequestPathname(req);
  writeCorsHeaders(req, res);

  if (req.method === 'OPTIONS' && pathname === '/publish-facebook-ad') {
    res.writeHead(isAllowedOrigin(origin) ? 204 : 403);
    res.end();
    return;
  }

  if (req.method !== 'POST' || pathname !== '/publish-facebook-ad') {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  if (origin && !isAllowedOrigin(origin)) {
    sendJson(res, 403, { error: 'Origin is not allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const preview = await buildPublishPreview(body);
    sendJson(res, 200, preview);
  } catch (error) {
    sendJson(res, 400, { error: error.message || 'Could not build publish preview' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Local publish server is running at http://${HOST}:${PORT}/`);
  console.log('Endpoint: POST /publish-facebook-ad');
});

async function buildPublishPreview(payload) {
  const adId = String(payload?.adId || '').trim();
  const region = normalizeSelection(payload?.region, VALID_REGIONS, 'all');
  const lap = normalizeSelection(payload?.lap, VALID_LAPS, 'all');

  if (!adId) throw new Error('Missing adId');

  const env = await readLocalEnv();
  const supabase = createSupabaseServiceClient(env);
  const ad = await loadAd(supabase, adId);
  const groups = applyLapFilter(applyRegionFilter(await loadPublisherGroups(supabase), region), lap);

  return {
    adTitle: ad.title || 'פרסומת',
    totalGroups: groups.length,
    groups: groups.map((group) => ({
      name: group.name,
      url: group.url,
      region: group.region || detectGroupRegion(group),
      language: group.language || 'he'
    }))
  };
}

async function loadAd(supabase, adId) {
  const { data, error } = await supabase
    .from('ads')
    .select('id,title,body,image,status')
    .eq('id', adId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Ad not found');
  return data;
}

async function loadPublisherGroups(supabase) {
  const fallbackGroups = (await readJsonFile(GROUPS_FILE, [])).map((group, index) => ({
    id: `static-${index + 1}`,
    name: group.name || '',
    url: group.url || '',
    language: group.language || 'he',
    imagePath: group.imagePath || DEFAULT_GROUP_IMAGE_PATH,
    link: group.link || LANDING_PAGE_URL,
    region: group.region || detectGroupRegion(group),
    source: 'static'
  }));

  const { data, error } = await supabase
    .from('publisher_groups')
    .select('name,url,language,image_path,link,region,active')
    .eq('active', true);

  if (error) throw error;

  const databaseGroups = (data || []).map((row) => ({
    name: row.name || '',
    url: row.url || '',
    language: row.language || 'he',
    imagePath: row.image_path || DEFAULT_GROUP_IMAGE_PATH,
    link: row.link || LANDING_PAGE_URL,
    region: row.region || detectGroupRegion(row),
    source: 'database'
  }));

  const byUrl = new Map();
  for (const group of fallbackGroups) byUrl.set(normalizeUrl(group.url), group);
  for (const group of databaseGroups) byUrl.set(normalizeUrl(group.url), group);
  return [...byUrl.values()].filter((group) => group.name && group.url);
}

function applyRegionFilter(groups, region) {
  if (!region || region === 'all') return groups;
  return groups.filter((group) => !isAllCountryGroup(group) && detectGroupRegion(group) === region);
}

function applyLapFilter(groups, lap) {
  if (!lap || lap === 'all') return groups;

  const lapIndex = Number(lap.replace('lap', '')) - 1;
  const lapCount = 4;
  const baseSize = Math.floor(groups.length / lapCount);
  const remainder = groups.length % lapCount;
  const startIndex = lapIndex * baseSize + Math.min(lapIndex, remainder);
  const size = baseSize + (lapIndex < remainder ? 1 : 0);
  return groups.slice(startIndex, startIndex + size);
}

function normalizeSelection(value, allowed, fallback) {
  const clean = String(value || fallback).trim().toLowerCase();
  return allowed.has(clean) ? clean : fallback;
}

function createSupabaseServiceClient(env) {
  const supabaseUrl = normalizeSupabaseUrl(env.SUPABASE_URL || env.VITE_SUPABASE_URL);
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL / VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function normalizeSupabaseUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

async function readLocalEnv() {
  const env = { ...process.env };
  try {
    const content = await fs.readFile(ENV_FILE, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;
      const [key, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      if (!env[key.trim()]) env[key.trim()] = value;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return env;
}

async function readJsonFile(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 100_000) {
        reject(new Error('Request body is too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function isAllCountryGroup(group) {
  if (group?.region === 'allcountry') return true;
  const name = normalizeHebrewText(group?.name || '');
  const explicitAllCountry = hasAny(name, ['בכל הארץ', 'כל הארץ', 'כל רחבי הארץ', 'כלל ארצי', 'ארצי']);
  const multiRegion = hasAny(name, ['מרכז']) && hasAny(name, ['צפון', 'דרום', 'ירושלים']);
  return explicitAllCountry || multiRegion;
}

function detectGroupRegion(group) {
  if (['north', 'center', 'jerusalem', 'sharon', 'south', 'allcountry'].includes(group?.region)) return group.region;
  const name = normalizeHebrewText(group?.name || '');
  if (isAllCountryGroup(group)) return 'allcountry';
  if (hasAny(name, ['ירושלים', 'בית שמש', 'מעלה אדומים'])) return 'jerusalem';
  if (hasAny(name, ['עמק חפר', 'השרון', 'שרון', 'חדרה', 'נתניה', 'רעננה', 'הרצליה'])) return 'sharon';
  if (hasAny(name, ['חיפה', 'קריות', 'הקריות', 'קריית', 'נשר', 'עכו', 'נהריה', 'טירת כרמל', 'צפון']) && !hasAny(name, ['תל אביב', 'ת א', 'תא'])) return 'north';
  if (hasAny(name, ['שדרות', 'אשדוד', 'אשקלון', 'קריית גת', 'באר שבע', 'נתיבות', 'דימונה', 'רהט', 'גדרה', 'יבנה', 'רחובות', 'דרום'])) return 'south';
  if (hasAny(name, ['מרכז', 'תל אביב', 'ת א', 'תא', 'פתח תקווה', 'פ ת', 'פתח תקוה', 'חולון', 'בת ים', 'ראשון לציון', 'רמלה', 'לוד', 'גוש דן', 'ראש העין', 'רמת גן', 'גבעתיים'])) return 'center';
  return 'allcountry';
}

function normalizeHebrewText(value) {
  return String(value)
    .replace(/[״"]/g, '')
    .replace(/[׳']/g, '')
    .replace(/[-_/\\|,().:;!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(value, needles) {
  return needles.some((needle) => value.includes(needle));
}

function normalizeUrl(url) {
  return String(url || '').trim().replace(/\/+$/, '').toLowerCase();
}

function writeCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    if (req.headers['access-control-request-private-network'] === 'true') {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function isAllowedOrigin(origin) {
  if (!origin) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin));
}

function getRequestPathname(req) {
  try {
    return new URL(req.url, `http://${HOST}:${PORT}`).pathname;
  } catch {
    return '';
  }
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

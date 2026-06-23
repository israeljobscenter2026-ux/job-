import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const CSV_FILE = process.argv[2] || 'C:/Users/emil1/Downloads/facebook-groups.csv';
const ENV_FILE = path.join(ROOT_DIR, '.env');
const GROUPS_FILE = path.join(ROOT_DIR, 'groups.json');
const BACKUP_DIR = path.join(ROOT_DIR, '.publisher-cache', 'group-backups');
const LANDING_PAGE_URL = 'https://israel-jobs-center2026.netlify.app/';
const DEFAULT_GROUP_IMAGE_PATH = path.join(
  ROOT_DIR,
  'assets',
  'ChatGPT_Image_Jun_18_2026_10_19_30_PM.png'
);

const env = await readLocalEnv();
const rows = parseCsv(await fs.readFile(CSV_FILE, 'utf8'));
const [, ...dataRows] = rows;
const groups = uniqueGroups(dataRows
  .map(([name, url]) => ({
    name: cleanText(name),
    url: normalizeFacebookGroupUrl(url)
  }))
  .filter((group) => group.name && group.url)
  .map((group) => ({
    name: group.name,
    url: group.url,
    language: 'he',
    image_path: DEFAULT_GROUP_IMAGE_PATH,
    link: LANDING_PAGE_URL,
    region: detectGroupRegion(group),
    active: true,
    updated_at: new Date().toISOString()
  })));

if (groups.length === 0) {
  throw new Error('CSV file did not contain valid groups. Nothing was changed.');
}

const counts = countByRegion(groups);
console.log('CSV rows:', dataRows.length);
console.log('Unique groups:', groups.length);
console.log('Regions:', counts);

const supabase = createSupabaseServiceClient(env);
const backup = await backupExistingGroups(supabase);
await replacePublisherGroups(supabase, groups);
await writeGroupsJson(groups);

console.log('');
console.log('========================================');
console.log(`Removed old groups: ${backup.databaseGroups.length}`);
console.log(`Added new groups: ${groups.length}`);
console.log(`north: ${counts.north || 0}`);
console.log(`center: ${counts.center || 0}`);
console.log(`jerusalem: ${counts.jerusalem || 0}`);
console.log(`south: ${counts.south || 0}`);
console.log(`sharon: ${counts.sharon || 0}`);
console.log(`allcountry: ${counts.allcountry || 0}`);
console.log(`Database backup: ${backup.databaseBackupFile}`);
console.log(`groups.json backup: ${backup.groupsJsonBackupFile}`);
console.log('========================================');

function parseCsv(content) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i += 1) {
    const char = content[i];
    const next = content[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(cell);
      cell = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some((value) => value.trim())) rows.push(row);
  }

  return rows;
}

function uniqueGroups(inputGroups) {
  const byUrl = new Map();
  for (const group of inputGroups) byUrl.set(normalizeUrl(group.url), group);
  return [...byUrl.values()];
}

function detectGroupRegion(group) {
  const name = normalizeHebrewText(group?.name || '');
  if (isAllCountryGroup(group)) return 'allcountry';
  if (hasAny(name, ['ירושל', 'בית שמש', 'מעלה אדומים'])) return 'jerusalem';
  if (hasAny(name, ['עמק חפר', 'השרון', 'שרון', 'חדרה', 'נתניה', 'רעננה', 'הרצליה'])) return 'sharon';
  if (hasAny(name, ['חיפה', 'קריות', 'הקריות', 'קריית', 'נשר', 'עכו', 'נהריה', 'טירת כרמל', 'צפון']) && !hasAny(name, ['תל אביב', 'ת א', 'תא'])) return 'north';
  if (hasAny(name, ['שדרות', 'אשדוד', 'אשקלון', 'קריית גת', 'באר שבע', 'נתיבות', 'דימונה', 'רהט', 'גדרה', 'יבנה', 'רחובות', 'דרום'])) return 'south';
  if (hasAny(name, ['מרכז', 'תל אביב', 'ת א', 'תא', 'פתח תקווה', 'פ ת', 'פתח תקוה', 'חולון', 'בת ים', 'ראשון לציון', 'רמלה', 'לוד', 'גוש דן', 'ראש העין', 'רמת גן', 'גבעתיים'])) return 'center';
  return 'allcountry';
}

function isAllCountryGroup(group) {
  const name = normalizeHebrewText(group?.name || '');
  const explicitAllCountry = hasAny(name, ['בכל הארץ', 'כל הארץ', 'כל רחבי הארץ', 'כלל ארצי', 'ארצי']);
  const multiRegion = hasAny(name, ['מרכז']) && hasAny(name, ['צפון', 'דרום', 'ירושל']);
  return explicitAllCountry || multiRegion;
}

function countByRegion(groups) {
  return groups.reduce((counts, group) => {
    counts[group.region] = (counts[group.region] || 0) + 1;
    return counts;
  }, {});
}

async function backupExistingGroups(supabase) {
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

  const { data, error } = await supabase
    .from('publisher_groups')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;

  const databaseBackupFile = path.join(BACKUP_DIR, `publisher-groups-${timestamp}.json`);
  const groupsJsonBackupFile = path.join(BACKUP_DIR, `groups-json-${timestamp}.json`);
  const groupsJson = await readJsonFile(GROUPS_FILE, []);

  await fs.writeFile(databaseBackupFile, `${JSON.stringify(data || [], null, 2)}\n`, 'utf8');
  await fs.writeFile(groupsJsonBackupFile, `${JSON.stringify(groupsJson, null, 2)}\n`, 'utf8');

  return {
    databaseGroups: data || [],
    databaseBackupFile,
    groupsJsonBackupFile
  };
}

async function replacePublisherGroups(supabase, groups) {
  const { error: deleteError } = await supabase
    .from('publisher_groups')
    .delete()
    .not('url', 'is', null);
  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase
    .from('publisher_groups')
    .insert(groups);
  if (insertError) throw insertError;
}

async function writeGroupsJson(groups) {
  const fileGroups = groups.map((group) => ({
    name: group.name,
    url: group.url,
    language: group.language,
    imagePath: group.image_path,
    link: group.link,
    region: group.region
  }));

  await fs.writeFile(GROUPS_FILE, `${JSON.stringify(fileGroups, null, 2)}\n`, 'utf8');
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

function normalizeSupabaseUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

function normalizeFacebookGroupUrl(url) {
  const clean = String(url || '').trim();
  if (!clean) return '';
  try {
    const parsed = new URL(clean);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/+$/, '/');
  } catch {
    return clean.replace(/\/+$/, '/');
  }
}

function normalizeUrl(url) {
  return normalizeFacebookGroupUrl(url).replace(/\/+$/, '').toLowerCase();
}

function cleanText(value) {
  return String(value || '').replace(/^\uFEFF/, '').replace(/\s+/g, ' ').trim();
}

function normalizeHebrewText(value) {
  return cleanText(value)
    .replace(/[״"]/g, '')
    .replace(/[׳']/g, '')
    .replace(/[-_/\\|,().:;!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(value, needles) {
  return needles.some((needle) => value.includes(needle));
}

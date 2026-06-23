import http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const HOST = '127.0.0.1';
const PORT = 4546;
const ROOT_DIR = process.cwd();
const ENV_FILE = path.join(ROOT_DIR, '.env');
const GROUPS_FILE = path.join(ROOT_DIR, 'groups.json');
const LOG_FILE = path.join(ROOT_DIR, 'publish-log.json');
const PROFILE_DIR = path.join(ROOT_DIR, 'facebook-profile');
const CACHE_DIR = path.join(ROOT_DIR, '.publisher-cache');
const LANDING_PAGE_URL = 'https://israel-jobs-center2026.netlify.app/';
const DEFAULT_GROUP_IMAGE_PATH = path.join(
  ROOT_DIR,
  'assets',
  'ChatGPT_Image_Jun_18_2026_10_19_30_PM.png'
);
const VALID_REGIONS = new Set(['north', 'south', 'center', 'sharon', 'jerusalem', 'allcountry', 'all']);
const VALID_LAPS = new Set(['lap1', 'lap2', 'lap3', 'lap4', 'all']);
const REGION_CHUNK_SIZE = 25;
const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/127\.0\.0\.1:\d+$/,
  /^http:\/\/localhost:\d+$/,
  /^https:\/\/israel-jobs-center2026\.netlify\.app$/
];
let publishInProgress = false;

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  const pathname = getRequestPathname(req);
  const isPreviewPath = pathname === '/publish-facebook-ad';
  const isStartPath = pathname === '/start-facebook-publish';
  writeCorsHeaders(req, res);

  if (req.method === 'OPTIONS' && (isPreviewPath || isStartPath)) {
    res.writeHead(isAllowedOrigin(origin) ? 204 : 403);
    res.end();
    return;
  }

  if (req.method !== 'POST' || (!isPreviewPath && !isStartPath)) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  if (origin && !isAllowedOrigin(origin)) {
    sendJson(res, 403, { error: 'Origin is not allowed' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    if (isPreviewPath) {
      const preview = await buildPublishPreview(body);
      sendJson(res, 200, preview);
      return;
    }

    if (publishInProgress) {
      sendJson(res, 409, { error: 'Publish is already running' });
      return;
    }

    publishInProgress = true;
    try {
      const summary = await startFacebookPublish(body);
      sendJson(res, 200, summary);
    } finally {
      publishInProgress = false;
    }
  } catch (error) {
    sendJson(res, 400, { error: error.message || 'Could not handle publish request' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Local publish server is running at http://${HOST}:${PORT}/`);
  console.log('Endpoint: POST /publish-facebook-ad');
  console.log('Endpoint: POST /start-facebook-publish');
});

async function buildPublishPreview(payload) {
  const adId = String(payload?.adId || '').trim();
  const lap = normalizeSelection(payload?.lap, VALID_LAPS, 'all');

  if (!adId) throw new Error('Missing adId');

  const env = await readLocalEnv();
  const supabase = createSupabaseServiceClient(env);
  const ad = await loadAd(supabase, adId);
  const region = resolvePublishRegion(payload, ad);
  const groups = applyLapFilter(applyRegionFilter(await loadPublisherGroups(supabase), region), lap);

  return {
    adTitle: ad.title || 'פרסומת',
    targetRegion: region,
    totalGroups: groups.length,
    groups: groups.map((group) => ({
      name: group.name,
      url: group.url,
      region: group.region || detectGroupRegion(group),
      language: group.language || 'he'
    }))
  };
}

async function startFacebookPublish(payload) {
  const adId = String(payload?.adId || '').trim();
  const lap = normalizeSelection(payload?.lap, VALID_LAPS, 'all');
  const dev = Boolean(payload?.dev);

  if (!adId) throw new Error('Missing adId');

  const env = await readLocalEnv();
  const supabase = createSupabaseServiceClient(env);
  const ad = await loadAd(supabase, adId);
  const region = resolvePublishRegion(payload, ad);
  const groups = applyLapFilter(applyRegionFilter(await loadPublisherGroups(supabase), region), lap);
  const selectedPostText = withLandingPageLink(ad.body || '');
  const selectedImagePath = await resolveAdImage(ad.image);

  if (!selectedPostText.trim()) throw new Error('Selected ad has no text');
  if (!selectedImagePath) throw new Error('Selected ad has no image');

  const summary = {
    started: true,
    adTitle: ad.title || 'פרסומת',
    targetRegion: region,
    totalGroups: groups.length,
    currentGroup: '',
    prepared: 0,
    skipped: 0,
    failed: 0,
    message: 'הפרסום רץ בחלון הדפדפן המקומי. יש לאשר ידנית כל פוסט בפייסבוק.'
  };
  const roundLabel = [region !== 'all' ? region : '', lap !== 'all' ? lap : ''].filter(Boolean).join('-') || 'all';
  const manualPublishTimeoutMs = dev ? 90_000 : 10 * 60_000;

  console.log(`Starting Facebook publish preparation for ${groups.length} groups.`);
  console.log('Safety: this tool prepares drafts only and never clicks the final Facebook publish button.');

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1366, height: 900 }
  });
  const page = context.pages()[0] || await context.newPage();

  try {
    for (let index = 0; index < groups.length; index += 1) {
      const group = groups[index];
      const timestamp = new Date().toISOString();
      summary.currentGroup = group.name;

      try {
        validateGroup(group, index);

        if (await wasPreparedRecently(group.url, 15 * 60_000)) {
          summary.skipped += 1;
          await appendLog({
            groupName: group.name,
            groupUrl: group.url,
            language: group.language || 'he',
            round: roundLabel,
            selectedPostText,
            timestamp,
            status: 'skipped'
          });
          console.log(`Skipped ${group.name}: prepared recently.`);
          continue;
        }

        console.log(`Preparing ${index + 1}/${groups.length}: ${group.name}`);
        await page.goto(group.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(2500);
        await copyToClipboard(selectedPostText);

        const result = await prepareFacebookDraft(page, { ...group, imagePath: selectedImagePath }, selectedPostText);
        if (!result.ok) {
          const status = result.skip ? 'skipped' : 'failed';
          summary[status] += 1;
          await appendLog({
            groupName: group.name,
            groupUrl: group.url,
            language: group.language || 'he',
            round: roundLabel,
            selectedPostText,
            timestamp,
            status
          });
          console.log(`${status === 'skipped' ? 'Skipped' : 'Failed'} ${group.name}: ${result.reason}`);
          continue;
        }

        console.log('Draft is ready. Please review it and click Publish manually in Facebook.');
        const published = await waitForPublishCompletion(page, selectedPostText, manualPublishTimeoutMs);
        const status = published ? 'prepared' : 'failed';
        if (status === 'prepared') summary.prepared += 1;
        else summary.failed += 1;

        await appendLog({
          groupName: group.name,
          groupUrl: group.url,
          language: group.language || 'he',
          round: roundLabel,
          selectedPostText,
          timestamp,
          status
        });

        if (index < groups.length - 1) {
          const delayMs = randomDelayMs(dev);
          console.log(`Waiting ${formatDelay(delayMs)} before the next group.`);
          await delay(delayMs);
        }
      } catch (error) {
        summary.failed += 1;
        await appendLog({
          groupName: group?.name || `group-${index + 1}`,
          groupUrl: group?.url || '',
          language: group?.language || '',
          round: roundLabel,
          selectedPostText,
          timestamp,
          status: 'failed'
        });
        console.log(`Failed group ${index + 1}: ${error.message}`);
      }
    }
  } finally {
    summary.currentGroup = '';
    await context.close();
  }

  return summary;
}

async function loadAd(supabase, adId) {
  const { data, error } = await supabase
    .from('ads')
    .select('id,title,body,image,status,target_region')
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
  const regionChunk = getRegionChunkParts(region);
  if (regionChunk) {
    const baseGroups = applyRegionFilter(groups, regionChunk.region);
    return getChunk(baseGroups, regionChunk.chunkNumber, REGION_CHUNK_SIZE);
  }
  if (region === 'allcountry') return groups.filter((group) => isAllCountryGroup(group) || detectGroupRegion(group) === 'allcountry');
  const allCountryChunk = getAllCountryChunkNumber(region);
  if (allCountryChunk) {
    const baseGroups = applyRegionFilter(groups, 'allcountry');
    return getChunk(baseGroups, allCountryChunk, REGION_CHUNK_SIZE);
  }
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
  if (getRegionChunkParts(clean) || getAllCountryChunkNumber(clean)) return clean;
  return allowed.has(clean) ? clean : fallback;
}

function resolvePublishRegion(payload, ad) {
  if (payload && Object.prototype.hasOwnProperty.call(payload, 'region')) {
    return normalizeSelection(payload.region, VALID_REGIONS, 'all');
  }
  return normalizeSelection(ad?.target_region, VALID_REGIONS, 'allcountry');
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

async function resolveAdImage(image) {
  const value = String(image || '').trim();
  if (!value) return '';

  const dataUrlMatch = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrlMatch) {
    const extByMime = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp'
    };
    const ext = extByMime[dataUrlMatch[1]] || '.png';
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const imagePath = path.join(CACHE_DIR, `selected-ad${ext}`);
    await fs.writeFile(imagePath, Buffer.from(dataUrlMatch[2], 'base64'));
    return imagePath;
  }

  if (await fileExists(value)) return value;
  return '';
}

function withLandingPageLink(text) {
  const clean = String(text || '').trim();
  if (!clean) return LANDING_PAGE_URL;
  if (clean.includes(LANDING_PAGE_URL)) return clean;
  return `${clean}\n\n${LANDING_PAGE_URL}`;
}

async function prepareFacebookDraft(page, group, preparedText) {
  try {
    await closeLightweightPrompts(page);

    const composerOpened = await openPostComposer(page);
    if (!composerOpened) {
      return { ok: false, skip: true, reason: 'Could not find the Facebook post composer.' };
    }

    await page.waitForTimeout(1500);
    const textBox = await findPostTextBox(page);
    if (!textBox) {
      return { ok: false, reason: 'Composer opened, but no text box was found.' };
    }

    if (group.imagePath) {
      const imageExists = await fileExists(group.imagePath);
      if (!imageExists) {
        return { ok: false, reason: `Image file was not found: ${group.imagePath}` };
      }

      const uploadImagePath = await prepareImageForUpload(group.imagePath);
      const imageUploaded = await uploadImageIfPossible(page, uploadImagePath);
      if (!imageUploaded) {
        return { ok: false, reason: 'Could not find an image upload control.' };
      }
    }

    const textBoxAfterImage = await findPostTextBox(page);
    if (!textBoxAfterImage) {
      return { ok: false, reason: 'Image uploaded, but the text box was not found again.' };
    }

    const textInserted = await insertPostText(page, textBoxAfterImage, preparedText);
    if (!textInserted) {
      return { ok: false, reason: 'Image uploaded, but text was not inserted.' };
    }

    return { ok: true };
  } catch (error) {
    return { ok: false, reason: error.message };
  }
}

async function openPostComposer(page) {
  const textCandidates = [
    'כאן כותבים',
    'כאן כותבים...',
    'מה בא לך לשתף',
    'כתוב משהו',
    'יצירת פוסט',
    'Create post',
    'Write something',
    "What's on your mind"
  ];

  for (const text of textCandidates) {
    const clicked = await clickFirstVisible(page.getByText(text, { exact: false }));
    if (clicked) return true;
  }

  const composerSelectors = [
    'div[role="main"] div[role="button"]',
    'div[role="main"] div[role="textbox"]',
    'div[role="main"] span'
  ];

  for (const selector of composerSelectors) {
    const clicked = await clickFirstVisible(
      page.locator(selector).filter({ hasText: /כאן כותבים|כתוב משהו|Write something|What's on your mind/i })
    );
    if (clicked) return true;
  }

  for (const name of ['יצירת פוסט', 'Create post']) {
    const clicked = await clickFirstVisible(page.getByRole('button', { name, exact: false }));
    if (clicked) return true;
  }

  return false;
}

async function findPostTextBox(page) {
  const selectors = [
    'div[role="dialog"] div[role="textbox"][contenteditable="true"]',
    'div[aria-modal="true"] div[role="textbox"][contenteditable="true"]',
    'div[role="textbox"][contenteditable="true"]'
  ];

  for (const selector of selectors) {
    const locator = page.locator(selector).last();
    try {
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      return locator;
    } catch {
      // Try the next selector.
    }
  }

  return null;
}

async function insertPostText(page, textBox, preparedText) {
  await textBox.click({ timeout: 8000 });
  await page.waitForTimeout(500);
  await clearTextBoxIfNeeded(page);

  const attempts = [
    async () => textBox.fill(preparedText, { timeout: 8000 }),
    async () => {
      await copyToClipboard(preparedText);
      await page.keyboard.press(`${shortcutModifier()}+V`);
    },
    async () => page.keyboard.insertText(preparedText)
  ];

  for (const attempt of attempts) {
    try {
      await attempt();
      await page.waitForTimeout(1000);
      if (await textBoxContainsText(textBox, preparedText)) return true;
      await textBox.click({ timeout: 5000 });
    } catch {
      // Try the next method.
    }
  }

  return false;
}

async function clearTextBoxIfNeeded(page) {
  await page.keyboard.press(`${shortcutModifier()}+A`).catch(() => {});
  await page.keyboard.press('Backspace').catch(() => {});
  await page.waitForTimeout(300);
}

async function textBoxContainsText(textBox, preparedText) {
  try {
    const currentText = await textBox.innerText({ timeout: 3000 });
    const firstMeaningfulLine = preparedText.split('\n').find((line) => line.trim().length > 8);
    return Boolean(firstMeaningfulLine && currentText.includes(firstMeaningfulLine.trim()));
  } catch {
    return false;
  }
}

async function uploadImageIfPossible(page, imagePath) {
  const photoButtons = [
    page.getByText('תמונה/סרטון', { exact: false }),
    page.getByText('Photo/video', { exact: false }),
    page.getByLabel('תמונה/סרטון', { exact: false }),
    page.getByLabel('Photo/video', { exact: false })
  ];

  for (const button of photoButtons) {
    await clickFirstVisible(button);
    await page.waitForTimeout(750);
    if (await setFirstFileInput(page, imagePath)) return true;
  }

  return setFirstFileInput(page, imagePath);
}

async function prepareImageForUpload(imagePath) {
  await fs.mkdir(CACHE_DIR, { recursive: true });
  const ext = path.extname(imagePath).toLowerCase() || '.png';
  const safePath = path.join(CACHE_DIR, `post-image${ext}`);
  await fs.copyFile(imagePath, safePath);
  return safePath;
}

async function setFirstFileInput(page, imagePath) {
  const inputs = page.locator('input[type="file"]');
  const count = await inputs.count();

  for (let i = count - 1; i >= 0; i -= 1) {
    try {
      await inputs.nth(i).setInputFiles(imagePath, { timeout: 5000 });
      await page.waitForTimeout(1500);
      return true;
    } catch {
      // Try the next input.
    }
  }

  return false;
}

async function clickFirstVisible(locator) {
  const count = await locator.count().catch(() => 0);

  for (let i = 0; i < count; i += 1) {
    const item = locator.nth(i);
    try {
      if (await item.isVisible({ timeout: 1000 })) {
        await item.click({ timeout: 5000 });
        return true;
      }
    } catch {
      // Try the next locator.
    }
  }

  return false;
}

async function closeLightweightPrompts(page) {
  for (const text of ['לא עכשיו', 'Not now', 'דלג', 'Skip']) {
    const clicked = await clickFirstVisible(page.getByText(text, { exact: true }));
    if (clicked) {
      await page.waitForTimeout(1000);
      return;
    }
  }
}

async function waitForPublishCompletion(page, preparedText, timeoutMs) {
  const startedAt = Date.now();
  let sawPreparedComposer = false;

  while (Date.now() - startedAt < timeoutMs) {
    const hasComposer = await hasVisiblePostComposer(page);
    const stillHasPreparedText = await composerStillContainsPreparedText(page, preparedText);

    if (hasComposer || stillHasPreparedText) {
      sawPreparedComposer = true;
    }

    if (sawPreparedComposer && !hasComposer && !stillHasPreparedText) {
      return true;
    }

    if (sawPreparedComposer && !stillHasPreparedText) {
      return true;
    }

    await delay(2000);
  }

  return false;
}

async function hasVisiblePostComposer(page) {
  const dialogs = page.locator('div[role="dialog"]').filter({ hasText: /יצירת פוסט|Create post|פרסום|Post/i });
  const count = await dialogs.count().catch(() => 0);

  for (let i = 0; i < count; i += 1) {
    try {
      if (await dialogs.nth(i).isVisible({ timeout: 500 })) return true;
    } catch {
      // Continue checking.
    }
  }

  return false;
}

async function composerStillContainsPreparedText(page, preparedText) {
  const firstMeaningfulLine = preparedText
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 8);

  if (!firstMeaningfulLine) return false;

  const dialogs = page.locator('div[role="dialog"]').filter({ hasText: /יצירת פוסט|Create post|פרסום|Post/i });
  const count = await dialogs.count().catch(() => 0);

  for (let i = 0; i < count; i += 1) {
    const dialog = dialogs.nth(i);
    try {
      if (!(await dialog.isVisible({ timeout: 500 }))) continue;
      const text = await dialog.innerText({ timeout: 1000 });
      if (text.includes(firstMeaningfulLine)) return true;
    } catch {
      // Continue checking.
    }
  }

  return false;
}

async function copyToClipboard(text) {
  if (process.platform === 'win32') {
    await pipeToCommand('powershell.exe', ['-NoProfile', '-Command', 'Set-Clipboard'], text);
    return;
  }

  if (process.platform === 'darwin') {
    await pipeToCommand('pbcopy', [], text);
    return;
  }

  try {
    await pipeToCommand('wl-copy', [], text);
  } catch {
    await pipeToCommand('xclip', ['-selection', 'clipboard'], text);
  }
}

function pipeToCommand(command, commandArgs, text) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, { stdio: ['pipe', 'ignore', 'pipe'] });
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `${command} exited with code ${code}`));
    });
    child.stdin.end(text);
  });
}

async function appendLog(entry) {
  const currentLog = await readJsonFile(LOG_FILE, []);
  const nextLog = Array.isArray(currentLog) ? currentLog : [];
  nextLog.push(entry);
  await writeJson(LOG_FILE, nextLog);
}

async function wasPreparedRecently(groupUrl, windowMs) {
  const currentLog = await readJsonFile(LOG_FILE, []);
  if (!Array.isArray(currentLog)) return false;

  const now = Date.now();
  return currentLog.some((entry) => {
    if (entry?.groupUrl !== groupUrl) return false;
    if (entry?.status !== 'prepared') return false;

    const time = new Date(entry.timestamp).getTime();
    if (Number.isNaN(time)) return false;
    return now - time <= windowMs;
  });
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function validateGroup(group, index) {
  if (!group || typeof group !== 'object') throw new Error(`Group ${index + 1} is invalid.`);
  if (!group.name) throw new Error(`Missing group name at index ${index + 1}.`);
  if (!group.url) throw new Error(`Missing group url for ${group.name}.`);
}

function randomDelayMs(devMode) {
  const min = devMode ? 5_000 : 3 * 60_000;
  const max = devMode ? 15_000 : 10 * 60_000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDelay(ms) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} seconds`;
  return `${Math.round(seconds / 60)} minutes`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortcutModifier() {
  return process.platform === 'darwin' ? 'Meta' : 'Control';
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

function getRegionChunkParts(value) {
  const match = String(value || '').match(/^(north|center|jerusalem|sharon|south)(\d+)$/);
  if (!match) return null;
  const chunkNumber = Number(match[2]);
  if (!Number.isFinite(chunkNumber) || chunkNumber < 1) return null;
  return { region: match[1], chunkNumber };
}

function getAllCountryChunkNumber(value) {
  const match = String(value || '').match(/^all(\d+)$/);
  if (!match) return null;
  const chunkNumber = Number(match[1]);
  return Number.isFinite(chunkNumber) && chunkNumber > 0 ? chunkNumber : null;
}

function getChunk(groups, chunkNumber, chunkSize) {
  const startIndex = (chunkNumber - 1) * chunkSize;
  return groups.slice(startIndex, startIndex + chunkSize);
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

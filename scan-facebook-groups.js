import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const ROOT_DIR = process.cwd();
const ENV_FILE = path.join(ROOT_DIR, '.env');
const GROUPS_FILE = path.join(ROOT_DIR, 'groups.json');
const PROFILE_DIR = path.join(ROOT_DIR, 'facebook-profile');
const OUTPUT_JSON = path.join(ROOT_DIR, 'facebook-groups-scan.json');
const LANDING_PAGE_URL = 'https://israel-jobs-center2026.netlify.app/';
const DEFAULT_GROUP_IMAGE_PATH = 'C:/Users/emil1/Documents/מערכת למשרות/assets/ChatGPT_Image_Jun_18_2026_10_19_30_PM.png';

const rl = readline.createInterface({ input, output });

try {
  const env = await readLocalEnv();
  const supabase = await createAuthenticatedSupabase(env);
  const existingUrls = await loadExistingGroupUrls(supabase);
  for (const group of await readJson(GROUPS_FILE, [])) {
    existingUrls.add(normalizeUrl(group.url));
  }
  const scannedGroups = await scanFacebookGroups();
  const normalizedGroups = uniqueGroups(scannedGroups).map((group) => ({
    name: group.name,
    url: normalizeUrl(group.url),
    language: 'he',
    image_path: DEFAULT_GROUP_IMAGE_PATH,
    link: LANDING_PAGE_URL,
    region: detectGroupRegion(group),
    active: true,
    updated_at: new Date().toISOString()
  }));

  await fs.writeFile(OUTPUT_JSON, `${JSON.stringify(normalizedGroups, null, 2)}\n`, 'utf8');

  const newGroups = normalizedGroups.filter((group) => !existingUrls.has(normalizeUrl(group.url)));
  if (normalizedGroups.length > 0) {
    const { error } = await supabase
      .from('publisher_groups')
      .upsert(normalizedGroups, { onConflict: 'url' });
    if (error) throw error;
  }

  console.log('');
  console.log('========================================');
  console.log(`נסרקו קבוצות: ${normalizedGroups.length}`);
  console.log(`קבוצות חדשות שנוספו למערכת ולבוט: ${newGroups.length}`);
  console.log(`קובץ גיבוי נוצר: ${OUTPUT_JSON}`);
  console.log('========================================');
} catch (error) {
  console.error(`שגיאה בסריקה: ${error.message}`);
  process.exitCode = 1;
} finally {
  rl.close();
}

async function scanFacebookGroups() {
  // משתמשים בפרופיל הקבוע של Playwright כדי להישאר מחוברים לפייסבוק בין הרצות.
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1366, height: 900 }
  });

  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto('https://www.facebook.com/groups/joins/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('נפתח עמוד הקבוצות בפייסבוק.');
    console.log('אם צריך להתחבר או לאשר משהו בפייסבוק, בצע זאת בדפדפן ואז לחץ Enter כאן.');
    await rl.question('');

    const groups = new Map();
    for (let i = 0; i < 80; i += 1) {
      await page.mouse.wheel(0, 1500);
      await page.waitForTimeout(900);

      const found = await page.evaluate(() => {
        const results = [];
        document.querySelectorAll('a[href*="/groups/"]').forEach((link) => {
          const href = link.href;
          const text = (link.innerText || link.textContent || '').trim();
          if (!href || !text) return;
          results.push({ name: text, url: href.split('?')[0] });
        });
        return results;
      });

      for (const item of found) {
        if (!isRealGroupUrl(item.url)) continue;
        const name = cleanName(item.name);
        if (!isUsefulGroupName(name)) continue;
        groups.set(normalizeUrl(item.url), { name, url: normalizeUrl(item.url) });
      }

      console.log(`נמצאו עד עכשיו: ${groups.size}`);
    }

    return [...groups.values()];
  } finally {
    await context.close();
  }
}

async function createAuthenticatedSupabase(env) {
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('חסרים VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY בקובץ .env');
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const email = env.SUPABASE_LOGIN_EMAIL || await rl.question('אימייל כניסה למערכת: ');
  const password = env.SUPABASE_LOGIN_PASSWORD || await rl.question('סיסמה למערכת: ');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`התחברות למערכת נכשלה: ${error.message}`);
  return supabase;
}

async function loadExistingGroupUrls(supabase) {
  const { data, error } = await supabase.from('publisher_groups').select('url');
  if (error) throw error;
  return new Set((data || []).map((row) => normalizeUrl(row.url)));
}

function uniqueGroups(groups) {
  const byUrl = new Map();
  for (const group of groups) byUrl.set(normalizeUrl(group.url), group);
  return [...byUrl.values()];
}

function isRealGroupUrl(url) {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length !== 2 || parts[0] !== 'groups') return false;
    const blocked = new Set(['feed', 'discover', 'joins', 'create', 'categories', 'my_removed_content']);
    return !blocked.has(parts[1]);
  } catch {
    return false;
  }
}

function isUsefulGroupName(name) {
  if (name.length < 2) return false;
  if (name.includes('הצגת הקבוצה')) return false;
  if (name.includes('הצטרפות')) return false;
  if (name.includes('הצטרף')) return false;
  return true;
}

function cleanName(name) {
  return String(name).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
}

function detectGroupRegion(group) {
  const name = normalizeHebrewText(group?.name || '');
  if (isAllCountryGroup(group)) return 'allcountry';
  if (hasAny(name, ['ירושלים', 'בית שמש', 'מעלה אדומים'])) return 'jerusalem';
  if (hasAny(name, ['עמק חפר', 'השרון', 'שרון', 'חדרה', 'נתניה', 'רעננה', 'הרצליה'])) return 'sharon';
  if (hasAny(name, ['חיפה', 'קריות', 'הקריות', 'קריית', 'נשר', 'עכו', 'נהריה', 'טירת כרמל', 'צפון']) && !hasAny(name, ['תל אביב', 'ת א', 'תא'])) return 'north';
  if (hasAny(name, ['שדרות', 'אשדוד', 'אשקלון', 'קריית גת', 'באר שבע', 'נתיבות', 'דימונה', 'רהט', 'גדרה', 'יבנה', 'רחובות', 'דרום'])) return 'south';
  if (hasAny(name, ['מרכז', 'תל אביב', 'ת א', 'תא', 'פתח תקווה', 'פ ת', 'פתח תקוה', 'חולון', 'בת ים', 'ראשון לציון', 'רמלה', 'לוד', 'גוש דן', 'ראש העין', 'רמת גן', 'גבעתיים'])) return 'center';
  return 'allcountry';
}

function isAllCountryGroup(group) {
  const name = normalizeHebrewText(group?.name || '');
  const explicitAllCountry = hasAny(name, ['בכל הארץ', 'כל הארץ', 'כל רחבי הארץ', 'כלל ארצי', 'ארצי']);
  const multiRegion = hasAny(name, ['מרכז']) && hasAny(name, ['צפון', 'דרום', 'ירושלים']);
  return explicitAllCountry || multiRegion;
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

async function readJson(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw error;
  }
}

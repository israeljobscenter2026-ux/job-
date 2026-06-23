import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { pathToFileURL } from 'node:url';

const ROOT_DIR = process.cwd();
const ENV_FILE = path.join(ROOT_DIR, '.env');
const GROUPS_FILE = path.join(ROOT_DIR, 'groups.json');
const PROFILE_DIR = process.env.FACEBOOK_SCAN_PROFILE_DIR
  ? path.resolve(process.env.FACEBOOK_SCAN_PROFILE_DIR)
  : path.join(ROOT_DIR, 'facebook-page-profile');
const OUTPUT_JSON = path.join(ROOT_DIR, 'facebook-groups-scan.json');
const BACKUP_DIR = path.join(ROOT_DIR, '.publisher-cache', 'group-backups');
const LANDING_PAGE_URL = 'https://israel-jobs-center2026.netlify.app/';
const DEFAULT_GROUP_IMAGE_PATH = path.join(
  ROOT_DIR,
  'assets',
  'ChatGPT_Image_Jun_18_2026_10_19_30_PM.png'
);

export async function runFacebookGroupScan(options = {}) {
  const interactive = options.interactive ?? false;
  const resetExisting = options.resetExisting ?? false;
  const logger = options.logger || console;
  const rl = interactive ? readline.createInterface({ input, output }) : null;

  try {
    const env = await readLocalEnv();
    const scannedGroups = await scanFacebookGroups({ interactive, logger, rl });
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

    if (resetExisting && normalizedGroups.length === 0) {
      throw new Error('הסריקה מצאה 0 קבוצות, לכן עצרתי ולא מחקתי את הקבוצות הקיימות.');
    }

    const supabase = createSupabaseServiceClient(env);
    if (resetExisting) {
      const backup = await backupExistingGroups(supabase);
      await replacePublisherGroups(supabase, normalizedGroups);
      await writeGroupsJson(normalizedGroups);

      const summary = {
        found: normalizedGroups.length,
        added: normalizedGroups.length,
        skipped: 0,
        removed: backup.databaseGroups.length,
        backupFile: OUTPUT_JSON,
        databaseBackupFile: backup.databaseBackupFile,
        groupsJsonBackupFile: backup.groupsJsonBackupFile
      };

      logger.log('');
      logger.log('========================================');
      logger.log(`Found ${summary.found} groups`);
      logger.log(`Removed ${summary.removed} old groups`);
      logger.log(`Added ${summary.added} new groups`);
      logger.log(`Skipped ${summary.skipped} existing groups`);
      logger.log(`Scan file created: ${OUTPUT_JSON}`);
      logger.log(`Database backup created: ${summary.databaseBackupFile}`);
      logger.log(`groups.json backup created: ${summary.groupsJsonBackupFile}`);
      logger.log('========================================');

      return summary;
    }

    const existingUrls = await loadExistingGroupUrls(supabase);
    for (const group of await readJson(GROUPS_FILE, [])) {
      existingUrls.add(normalizeUrl(group.url));
    }

    const newGroups = normalizedGroups.filter((group) => !existingUrls.has(normalizeUrl(group.url)));
    const skippedGroups = normalizedGroups.length - newGroups.length;

    if (newGroups.length > 0) {
      const { error } = await supabase
        .from('publisher_groups')
        .insert(newGroups);
      if (error) throw error;
    }

    const summary = {
      found: normalizedGroups.length,
      added: newGroups.length,
      skipped: skippedGroups,
      backupFile: OUTPUT_JSON
    };

    logger.log('');
    logger.log('========================================');
    logger.log(`Found ${summary.found} groups`);
    logger.log(`Added ${summary.added} new groups`);
    logger.log(`Skipped ${summary.skipped} existing groups`);
    logger.log(`Backup file created: ${OUTPUT_JSON}`);
    logger.log('========================================');

    return summary;
  } finally {
    if (rl) rl.close();
  }
}

async function scanFacebookGroups({ interactive, logger, rl }) {
  // משתמשים בפרופיל קבוע של הדף החדש כדי שפייסבוק יישאר מחובר בין הרצות.
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1366, height: 900 }
  });

  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto('https://www.facebook.com/groups/joins/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    logger.log('Facebook groups page opened.');

    if (interactive) {
      logger.log('If Facebook asks you to login or confirm something, do it in the browser, then press Enter here.');
      await rl.question('');
    } else {
      logger.log('Waiting a few seconds before scanning. Complete Facebook prompts in the opened browser if needed.');
      await page.waitForTimeout(7000);
    }

    const groups = new Map();
    for (let i = 0; i < 80; i += 1) {
      await page.mouse.wheel(0, 1500);
      await page.waitForTimeout(900);

      const found = await page.evaluate(() => {
        const joinedButtonLabels = ['הצגת הקבוצה', 'View group'];
        const pendingLabels = ['עדכון התגובות', 'Update notifications', 'בקשה להצטרף', 'Request to join'];
        const results = [];
        const seen = new Set();

        function addResult(name, url) {
          if (!url || !name) return;
          const cleanUrl = url.split('?')[0];
          if (seen.has(cleanUrl)) return;
          seen.add(cleanUrl);
          results.push({ name, url: cleanUrl });
        }

        function findGroupCard(link) {
          let node = link;
          for (let depth = 0; depth < 12 && node; depth += 1) {
            const text = (node.innerText || node.textContent || '').trim();
            if (joinedButtonLabels.some((label) => text.includes(label))) return node;
            node = node.parentElement;
          }
          return null;
        }

        function findCardFromJoinedControl(control) {
          let node = control;
          for (let depth = 0; depth < 12 && node; depth += 1) {
            const text = (node.innerText || node.textContent || '').trim();
            const hasJoinedButton = joinedButtonLabels.some((label) => text.includes(label));
            const hasGroupLink = node.querySelector?.('a[href*="/groups/"]');
            if (hasJoinedButton && hasGroupLink) return node;
            node = node.parentElement;
          }
          return null;
        }

        document.querySelectorAll('button, div[role="button"], a[role="button"], span').forEach((control) => {
          const controlText = (control.innerText || control.textContent || '').trim();
          if (!joinedButtonLabels.some((label) => controlText.includes(label))) return;
          const card = findCardFromJoinedControl(control);
          if (!card) return;
          const cardText = (card.innerText || card.textContent || '').trim();
          if (pendingLabels.some((label) => cardText.includes(label))) return;
          const links = [...card.querySelectorAll('a[href*="/groups/"]')];
          for (const link of links) {
            const href = link.href;
            const text = (link.innerText || link.textContent || '').trim();
            if (!href || !text) continue;
            addResult(text, href);
          }
        });

        document.querySelectorAll('a[href*="/groups/"]').forEach((link) => {
          const href = link.href;
          const text = (link.innerText || link.textContent || '').trim();
          if (!href || !text) return;
          const card = findGroupCard(link);
          if (!card) return;
          const cardText = (card.innerText || card.textContent || '').trim();
          if (pendingLabels.some((label) => cardText.includes(label))) return;
          addResult(text, href);
        });
        return results;
      });

      for (const item of found) {
        if (!isRealGroupUrl(item.url)) continue;
        const name = cleanName(item.name);
        if (!isUsefulGroupName(name)) continue;
        groups.set(normalizeUrl(item.url), { name, url: normalizeUrl(item.url) });
      }

      logger.log(`Found so far: ${groups.size}`);
    }

    return [...groups.values()];
  } finally {
    await context.close();
  }
}

function createSupabaseServiceClient(env) {
  const supabaseUrl = normalizeSupabaseUrl(env.SUPABASE_URL || env.VITE_SUPABASE_URL);
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_URL / VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  // מפתח Service Role נשאר רק בסקריפט המקומי בצד Node ולא נשלח ל-Frontend.
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

async function loadExistingGroupUrls(supabase) {
  const { data, error } = await supabase.from('publisher_groups').select('url');
  if (error) throw error;
  return new Set((data || []).map((row) => normalizeUrl(row.url)));
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
  const groupsJson = await readJson(GROUPS_FILE, []);

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

  if (groups.length === 0) return;

  const { error: insertError } = await supabase
    .from('publisher_groups')
    .insert(groups);
  if (insertError) throw insertError;
}

async function writeGroupsJson(groups) {
  const fileGroups = groups.map((group) => ({
    name: group.name,
    url: group.url,
    language: group.language || 'he',
    imagePath: group.image_path || DEFAULT_GROUP_IMAGE_PATH,
    link: group.link || LANDING_PAGE_URL,
    region: group.region || detectGroupRegion(group)
  }));

  await fs.writeFile(GROUPS_FILE, `${JSON.stringify(fileGroups, null, 2)}\n`, 'utf8');
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runFacebookGroupScan({
    interactive: true,
    resetExisting: process.argv.includes('--reset')
  }).catch((error) => {
    console.error(`Scan error: ${error.message}`);
    process.exitCode = 1;
  });
}

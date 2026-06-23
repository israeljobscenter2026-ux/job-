import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const GROUPS_FILE = path.join(ROOT_DIR, 'groups.json');
const ENV_FILE = path.join(ROOT_DIR, '.env');
const PROFILE_DIR = path.join(ROOT_DIR, 'facebook-page-profile');
const JOIN_LOG_FILE = path.join(ROOT_DIR, 'join-groups-log.json');

const args = process.argv.slice(2);
const isDevMode = args.includes('--dev');
const retryCompleted = args.includes('--retry');
const maxGroupsArg = args.find((arg) => arg.startsWith('--limit='));
const maxGroups = maxGroupsArg ? Number(maxGroupsArg.split('=')[1]) : 0;
const waitMinutesArg = args.find((arg) => arg.startsWith('--wait-minutes='));
const waitMinutes = waitMinutesArg ? Number(waitMinutesArg.split('=')[1]) : isDevMode ? 3 : 10;
const waitMs = Math.max(1, waitMinutes) * 60_000;
const delaySecondsArg = args.find((arg) => arg.startsWith('--delay-seconds='));
const fixedDelaySeconds = delaySecondsArg ? Number(delaySecondsArg.split('=')[1]) : 0;
const loginWaitMinutesArg = args.find((arg) => arg.startsWith('--login-wait-minutes='));
const loginWaitMinutes = loginWaitMinutesArg ? Number(loginWaitMinutesArg.split('=')[1]) : 5;

try {
  const fallbackGroups = await readJsonFile(GROUPS_FILE, []);
  const allGroups = await loadPublisherGroups(fallbackGroups);
  const joinLog = await readJsonFile(JOIN_LOG_FILE, []);
  const completedUrls = new Set(
    joinLog
      .filter((entry) => ['joined', 'pending', 'already_member'].includes(entry.status))
      .map((entry) => normalizeUrl(entry.groupUrl))
  );

  let groups = allGroups.filter((group) => group.name && group.url);
  if (!retryCompleted) {
    groups = groups.filter((group) => !completedUrls.has(normalizeUrl(group.url)));
  }
  if (Number.isFinite(maxGroups) && maxGroups > 0) {
    groups = groups.slice(0, maxGroups);
  }

  if (groups.length === 0) {
    console.log('אין קבוצות חדשות להצטרפות. אם תרצה לעבור שוב על כולן, הרץ עם --retry.');
    process.exit(0);
  }

  console.log(`\nמתחיל בוט הצטרפות לקבוצות${isDevMode ? ' במצב בדיקה' : ''}.`);
  console.log(`קבוצות להרצה: ${groups.length}.`);
  console.log('חשוב: הבוט לא מפרסם כלום ולא לוחץ הצטרפות לבד.');
  console.log('אתה מאשר ידנית הצטרפות או שולח בקשה, והבוט מזהה את זה ועובר לקבוצה הבאה.');
  console.log('בפעם הראשונה התחבר לפייסבוק ובחר לעבוד בתור הדף החדש.\n');

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1366, height: 900 }
  });
  const page = context.pages()[0] || await context.newPage();

  const loggedIn = await waitForFacebookLogin(page, loginWaitMinutes * 60_000);
  if (!loggedIn) {
    console.log(`לא זוהתה התחברות אחרי ${loginWaitMinutes} דקות. עצרתי בלי לפתוח בקשות התחברות נוספות.`);
    await context.close();
    process.exit(0);
  }

  let joined = 0;
  let pending = 0;
  let skipped = 0;
  let failed = 0;

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    console.log('\n========================================');
    console.log(`קבוצה ${index + 1}/${groups.length}`);
    console.log(`שם: ${group.name}`);
    console.log(`קישור: ${group.url}`);
    console.log('פתחתי את הקבוצה. אם מופיע "הצטרף", בחר את הדף החדש ואשר ידנית.');
    console.log('אם יש שאלות הצטרפות, מלא אותן ידנית ושלח בקשה.');
    console.log('הבוט בודק לבד כל כמה שניות, וברגע שהוא מזהה הצטרפות או בקשה שנשלחה הוא ממשיך.\n');

    try {
      await page.goto(group.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000);

      const initialStatus = await detectJoinStatus(page);
      if (initialStatus.status !== 'unknown') {
        printDetectedStatus(initialStatus);
        await appendJoinLog(group, initialStatus.status, initialStatus.reason);
        if (initialStatus.status === 'joined' || initialStatus.status === 'already_member') joined += 1;
        else if (initialStatus.status === 'pending') pending += 1;
        continue;
      }

      const result = await waitForManualJoin(page, waitMs);
      printDetectedStatus(result);
      await appendJoinLog(group, result.status, result.reason);

      if (result.status === 'joined' || result.status === 'already_member') joined += 1;
      else if (result.status === 'pending') pending += 1;
      else if (result.status === 'skipped') skipped += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      console.log(`שגיאה בקבוצה הזו: ${error.message}`);
      await appendJoinLog(group, 'failed', error.message);
    }

    if (index < groups.length - 1) {
      const delay = fixedDelaySeconds > 0
        ? fixedDelaySeconds * 1000
        : isDevMode ? randomBetween(2000, 6000) : randomBetween(30_000, 90_000);
      console.log(`ממתין ${Math.round(delay / 1000)} שניות לפני הקבוצה הבאה...`);
      await page.waitForTimeout(delay);
    }
  }

  console.log('\nסיכום הצטרפות:');
  console.log(`הצטרפת/כבר חבר: ${joined}`);
  console.log(`בקשות שנשלחו: ${pending}`);
  console.log(`דולגו: ${skipped}`);
  console.log(`נכשלו/לא זוהו: ${failed}`);
  console.log(`הלוג נשמר בקובץ: ${JOIN_LOG_FILE}`);

  await context.close();
} catch (error) {
  console.error(`\nשגיאה כללית: ${error.message}`);
  process.exitCode = 1;
}

async function waitForManualJoin(page, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const status = await detectJoinStatus(page);
    if (status.status !== 'unknown') return status;

    const remainingSeconds = Math.max(0, Math.round((timeoutMs - (Date.now() - startedAt)) / 1000));
    console.log(`ממתין לזיהוי הצטרפות או בקשה שנשלחה... נשארו בערך ${remainingSeconds} שניות.`);
    await page.waitForTimeout(5000);
  }

  return { status: 'failed', reason: 'Timeout waiting for joined or pending state' };
}

async function waitForFacebookLogin(page, timeoutMs) {
  console.log('פותח פייסבוק להתחברות לדף החדש...');
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log(`ממתין להתחברות ראשונית עד ${Math.round(timeoutMs / 60_000)} דקות. לא אבצע רענון ולא אפתח בקשת התחברות נוספת בזמן ההמתנה.`);

  const startedAt = Date.now();
  let lastLogAt = 0;

  while (Date.now() - startedAt < timeoutMs) {
    if (page.isClosed()) {
      console.log('חלון פייסבוק נסגר. עצרתי את הבוט.');
      return false;
    }

    const loggedIn = await isFacebookLoggedIn(page);
    if (loggedIn) {
      console.log('זוהתה התחברות לפייסבוק. מתחיל לעבור על הקבוצות.');
      return true;
    }

    if (Date.now() - lastLogAt > 30_000) {
      const remainingSeconds = Math.max(0, Math.round((timeoutMs - (Date.now() - startedAt)) / 1000));
      console.log(`עדיין ממתין להתחברות ידנית. נשארו בערך ${remainingSeconds} שניות.`);
      lastLogAt = Date.now();
    }

    await page.waitForTimeout(5000);
  }

  return false;
}

async function isFacebookLoggedIn(page) {
  const url = page.url().toLowerCase();
  if (url.includes('/login') || url.includes('login.php')) return false;

  const loginInputVisible = await page.locator('input[name="email"], input[name="pass"]').first()
    .isVisible({ timeout: 500 })
    .catch(() => false);
  if (loginInputVisible) return false;

  const loggedInMarker = await page.locator('[aria-label="Facebook"], [aria-label="Home"], [aria-label="דף הבית"], [role="navigation"]').first()
    .isVisible({ timeout: 1000 })
    .catch(() => false);
  return loggedInMarker || url === 'https://www.facebook.com/' || url === 'https://www.facebook.com';
}

async function detectJoinStatus(page) {
  await closeLightweightPrompts(page);

  const text = normalizeText(await page.locator('body').innerText({ timeout: 5000 }).catch(() => ''));
  if (hasAny(text, [
    'בקשתך נשלחה',
    'בקשה נשלחה',
    'בקשת הצטרפות נשלחה',
    'pending',
    'request sent',
    'membership pending'
  ])) {
    return { status: 'pending', reason: 'Detected pending join request' };
  }

  if (hasAny(text, [
    'עזוב את הקבוצה',
    'עזיבת הקבוצה',
    'אתה חבר',
    'חבר בקבוצה',
    'joined',
    'leave group',
    'you are a member'
  ])) {
    return { status: 'already_member', reason: 'Detected existing group membership' };
  }

  const requestedButton = await hasVisibleButton(page, [
    'בקשה נשלחה',
    'requested',
    'pending'
  ]);
  if (requestedButton) return { status: 'pending', reason: 'Detected pending button' };

  const joinedButton = await hasVisibleButton(page, [
    'הצטרפת',
    'חבר',
    'joined',
    'member'
  ]);
  if (joinedButton) return { status: 'joined', reason: 'Detected joined button' };

  return { status: 'unknown', reason: 'No joined or pending state detected yet' };
}

async function hasVisibleButton(page, labels) {
  for (const label of labels) {
    const locator = page.getByRole('button', { name: new RegExp(escapeRegex(label), 'i') }).first();
    if (await locator.isVisible({ timeout: 500 }).catch(() => false)) return true;
  }
  return false;
}

async function closeLightweightPrompts(page) {
  const labels = ['לא עכשיו', 'Not now', 'דלג', 'Skip'];
  for (const label of labels) {
    const button = page.getByRole('button', { name: new RegExp(escapeRegex(label), 'i') }).first();
    if (await button.isVisible({ timeout: 500 }).catch(() => false)) {
      await button.click().catch(() => {});
      await page.waitForTimeout(500);
    }
  }
}

function printDetectedStatus(result) {
  if (result.status === 'joined' || result.status === 'already_member') {
    console.log('זוהה: הדף כבר חבר בקבוצה או ההצטרפות אושרה. עובר לקבוצה הבאה.');
  } else if (result.status === 'pending') {
    console.log('זוהה: בקשת הצטרפות נשלחה. עובר לקבוצה הבאה.');
  } else {
    console.log(`לא זוהה מצב הצטרפות: ${result.reason}`);
  }
}

async function loadPublisherGroups(fallbackGroups) {
  const env = await readLocalEnv();
  const supabaseUrl = normalizeSupabaseUrl(env.SUPABASE_URL || env.VITE_SUPABASE_URL);
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;
  const key = serviceRoleKey || anonKey;

  if (!supabaseUrl || !key) {
    return normalizeGroups(fallbackGroups);
  }

  const supabase = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await supabase
    .from('publisher_groups')
    .select('name,url,language,region,active')
    .eq('active', true);

  if (error) {
    console.log(`לא הצלחתי למשוך קבוצות מהמערכת, משתמש בקובץ groups.json: ${error.message}`);
    return normalizeGroups(fallbackGroups);
  }

  const databaseGroups = (data || []).map((row) => ({
    name: row.name || '',
    url: row.url || '',
    language: row.language || 'he',
    region: row.region || ''
  }));

  return normalizeGroups([...fallbackGroups, ...databaseGroups]);
}

function normalizeGroups(groups) {
  const byUrl = new Map();
  for (const group of groups || []) {
    const normalizedUrl = normalizeUrl(group.url);
    if (!normalizedUrl) continue;
    byUrl.set(normalizedUrl, {
      name: group.name || normalizedUrl,
      url: normalizeFacebookGroupUrl(group.url),
      language: group.language || 'he',
      region: group.region || ''
    });
  }
  return [...byUrl.values()];
}

async function appendJoinLog(group, status, reason) {
  const log = await readJsonFile(JOIN_LOG_FILE, []);
  log.push({
    groupName: group.name,
    groupUrl: normalizeFacebookGroupUrl(group.url),
    status,
    reason,
    timestamp: new Date().toISOString()
  });
  await fs.writeFile(JOIN_LOG_FILE, `${JSON.stringify(log, null, 2)}\n`, 'utf8');
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

function normalizeText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function hasAny(value, needles) {
  return needles.some((needle) => value.includes(String(needle).toLowerCase()));
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

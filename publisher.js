import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const TIME_ROUNDS = new Set(['morning', 'noon', 'evening']);
const LAP_ROUNDS = new Set(['lap1', 'lap2', 'lap3', 'lap4']);
const VALID_ROUNDS = new Set([...TIME_ROUNDS, ...LAP_ROUNDS]);
const ROOT_DIR = process.cwd();
const GROUPS_FILE = path.join(ROOT_DIR, 'groups.json');
const POSTS_FILE = path.join(ROOT_DIR, 'posts.json');
const ENV_FILE = path.join(ROOT_DIR, '.env');
const LOG_FILE = path.join(ROOT_DIR, 'publish-log.json');
const PROFILE_DIR = path.join(ROOT_DIR, 'facebook-profile');
const CACHE_DIR = path.join(ROOT_DIR, '.publisher-cache');

const args = process.argv.slice(2);
const round = normalizeRoundArg(args.filter((arg) => !arg.startsWith('-')));
const isDevMode = args.includes('--dev') || process.env.PUBLISHER_DEV === '1' || process.env.DEV_DELAY === '1';

if (!VALID_ROUNDS.has(round)) {
  console.error('Usage: node publisher.js morning|noon|evening|lap1|lap2|lap3|lap4 [--dev]');
  console.error('Example: node publisher.js lap1 --dev');
  process.exit(1);
}

const rl = readline.createInterface({ input, output });

try {
  const allGroups = await readJson(GROUPS_FILE, []);
  const posts = await readJson(POSTS_FILE, {});
  const activeAd = await loadActiveAd();

  if (!Array.isArray(allGroups) || allGroups.length === 0) {
    throw new Error('groups.json ריק או לא תקין.');
  }

  const postRound = getPostRound(round);
  const lapPlan = getLapPlan(allGroups, round);
  const groups = lapPlan.groups;

  if (!activeAd && !posts[postRound]) {
    throw new Error(`לא נמצאו טקסטים עבור הסבב "${postRound}" בקובץ posts.json.`);
  }

  // פרופיל קבוע שומר את ההתחברות לפייסבוק בין הרצות.
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    viewport: { width: 1366, height: 900 }
  });

  const page = context.pages()[0] || await context.newPage();

  console.log(`\nמתחיל סבב ${round}${isDevMode ? ' במצב פיתוח' : ''}.`);
  if (lapPlan.isLap) {
    console.log(`חלוקת ${round}: קבוצות באינדקס ${lapPlan.startIndex + 1}-${lapPlan.endIndex} מתוך ${allGroups.length}.`);
  }
  console.log(`מספר קבוצות להרצה הזו: ${groups.length}.`);
  if (activeAd) {
    console.log('הבוט משתמש בפרסומת הפעילה מתוך המערכת.');
  } else {
    console.log('לא נמצאה פרסומת פעילה מהמערכת. הבוט משתמש בגיבוי מתוך posts.json.');
  }
  console.log('חשוב: הכלי מכין טיוטה בלבד. הוא לא לוחץ על פרסום.\n');

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const timestamp = new Date().toISOString();
    let preparedText = '';

    try {
      validateGroup(group, index);

      // הפרסומת הפעילה במערכת מחליפה את הטקסט/התמונה הישנים של הבוט.
      const selectedPostText = activeAd?.body || selectPostText(posts, postRound, group.language);
      const selectedImagePath = activeAd?.imagePath || group.imagePath;
      preparedText = activeAd ? selectedPostText : buildPreparedText(selectedPostText, group.link);

      // אם כבר פרסמנו בקבוצה הזו ברבע שעה האחרונה, מדלגים כדי לא לפרסם כפול.
      if (await wasPreparedRecently(group.url, 15 * 60_000)) {
        console.log(`מדלג על ${group.name}: כבר הוכן/פורסם פוסט בקבוצה הזו ברבע שעה האחרונה.`);
        await appendLog({
          groupName: group.name,
          groupUrl: group.url,
          language: group.language,
          round,
          selectedPostText: preparedText,
          timestamp,
          status: 'skipped'
        });
        continue;
      }

      await page.goto(group.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2500);
      await copyToClipboard(preparedText);

      printGroupInstructions({
        group,
        round,
        preparedText,
        imagePath: selectedImagePath,
        index,
        total: groups.length
      });

      const result = await prepareFacebookDraft(page, { ...group, imagePath: selectedImagePath }, preparedText);
      if (result.ok) {
        console.log('הטיוטה הוכנה בפייסבוק. בדוק אותה ולחץ פרסום ידנית.');
        console.log('אחרי שהחלון ייסגר בעקבות הפרסום, הכלי יעבור אוטומטית לקבוצה הבאה.');
      } else if (result.skip) {
        console.log(`מדלג על הקבוצה: ${result.reason}`);
      } else {
        console.log(`לא הצלחתי להשלים הכנה אוטומטית: ${result.reason}`);
        console.log('הטקסט כבר בלוח. השלם ידנית ואז חזור לכאן.');
      }

      // המשתמש מפרסם ידנית בלבד. אם הטיוטה הוכנה, הכלי מזהה שהחלון נסגר וממשיך לבד.
      const status = result.skip
        ? 'skipped'
        : result.ok
        ? await waitForManualPublishOrFallback(page, preparedText)
        : normalizeAction(await askAction());

      await appendLog({
        groupName: group.name,
        groupUrl: group.url,
        language: group.language,
        round,
        selectedPostText: preparedText,
        timestamp,
        status
      });

      if (status === 'skipped') {
        console.log('הקבוצה סומנה כדילוג.');
      } else if (status === 'failed') {
        console.log('הקבוצה סומנה כתקלה.');
      } else {
        console.log('הקבוצה סומנה כמוכנה.');
      }
    } catch (error) {
      console.error(`שגיאה בקבוצה מספר ${index + 1}: ${error.message}`);
      await appendLog({
        groupName: group?.name || `group-${index + 1}`,
        groupUrl: group?.url || '',
        language: group?.language || '',
        round,
        selectedPostText: preparedText,
        timestamp,
        status: 'failed'
      });
    }

    if (index < groups.length - 1) {
      const delayMs = randomDelayMs(isDevMode);
      console.log(`ממתין ${formatDelay(delayMs)} לפני הקבוצה הבאה...\n`);
      await delay(delayMs);
    }
  }

  console.log('\nהסבב הסתיים.');
  await context.close();
} finally {
  rl.close();
}

async function prepareFacebookDraft(page, group, preparedText) {
  try {
    await closeLightweightPrompts(page);

    // פתיחת חלון יצירת פוסט. פייסבוק משנה טקסטים לעיתים, לכן יש כמה ניסיונות.
    const composerOpened = await openPostComposer(page);
    if (!composerOpened) {
      return { ok: false, skip: true, reason: 'לא נמצא כאן כותבים / כפתור יצירת פוסט.' };
    }

    await page.waitForTimeout(1500);

    // הכנסת הטקסט לפוסט. יש כמה שיטות כי פייסבוק משנה את עורך הפוסט לעיתים.
    const textBox = await findPostTextBox(page);
    if (!textBox) {
      return { ok: false, reason: 'חלון הפוסט נפתח, אבל לא נמצאה תיבת טקסט.' };
    }

    // העלאת תמונה אם הוגדר נתיב וקובץ קיים.
    if (group.imagePath) {
      const imageExists = await fileExists(group.imagePath);
      if (!imageExists) {
        return { ok: false, reason: `התמונה לא נמצאה: ${group.imagePath}` };
      }

      const uploadImagePath = await prepareImageForUpload(group.imagePath);
      const imageUploaded = await uploadImageIfPossible(page, uploadImagePath);
      if (!imageUploaded) {
        return { ok: false, reason: 'לא נמצא כפתור/שדה להעלאת תמונה.' };
      }
    }

    // אחרי העלאת תמונה פייסבוק לפעמים מאפס את העורך, לכן מכניסים טקסט בסוף.
    const textBoxAfterImage = await findPostTextBox(page);
    if (!textBoxAfterImage) {
      return { ok: false, reason: 'התמונה עלתה, אבל לא נמצאה שוב תיבת טקסט.' };
    }

    const textInserted = await insertPostText(page, textBoxAfterImage, preparedText);
    if (!textInserted) {
      return { ok: false, reason: 'התמונה עלתה, אבל הטקסט לא נכנס לתיבת הפוסט.' };
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

  // בקבוצות בעברית פייסבוק מציג לפעמים את אזור הפוסט כתיבת placeholder בתוך כפתור/תיבה.
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

  const roleCandidates = ['יצירת פוסט', 'Create post'];
  for (const name of roleCandidates) {
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
      // ממשיכים לניסיון הבא.
    }
  }

  return null;
}

async function insertPostText(page, textBox, preparedText) {
  await textBox.click({ timeout: 8000 });
  await page.waitForTimeout(500);
  await clearTextBoxIfNeeded(page, textBox);

  const attempts = [
    async () => {
      await textBox.fill(preparedText, { timeout: 8000 });
    },
    async () => {
      await copyToClipboard(preparedText);
      await page.keyboard.press(shortcutModifier() + '+V');
    },
    async () => {
      await page.keyboard.insertText(preparedText);
    }
  ];

  for (const attempt of attempts) {
    try {
      await attempt();
      await page.waitForTimeout(1000);
      if (await textBoxContainsText(textBox, preparedText)) return true;
      await textBox.click({ timeout: 5000 });
    } catch {
      // ממשיכים לשיטה הבאה.
    }
  }

  return false;
}

async function clearTextBoxIfNeeded(page, textBox) {
  try {
    const currentText = await textBox.innerText({ timeout: 2000 });
    if (!currentText.trim()) return;
    await page.keyboard.press(shortcutModifier() + '+A');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(300);
  } catch {
    // אם אי אפשר לנקות, ממשיכים ומנסים להכניס טקסט בכל זאת.
  }
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
  // קודם מנסים ללחוץ על כפתור תמונה/וידאו כדי שפייסבוק יחשוף input file.
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
  // פייסבוק/Chromium יכולים להיכשל עם נתיבים בעברית, לכן יוצרים עותק זמני בשם פשוט.
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
    const inputLocator = inputs.nth(i);
    try {
      await inputLocator.setInputFiles(imagePath, { timeout: 5000 });
      await page.waitForTimeout(1500);
      return true;
    } catch {
      // חלק מהשדות שייכים לאזורים אחרים בדף. ממשיכים לשדה הבא.
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
      // ממשיכים לאפשרות הבאה.
    }
  }

  return false;
}

async function closeLightweightPrompts(page) {
  // סגירת חלונות קלים כמו "לא עכשיו" כדי שלא יסתירו את הקבוצה.
  const dismissTexts = ['לא עכשיו', 'Not now', 'דלג', 'Skip'];

  for (const text of dismissTexts) {
    const locator = page.getByText(text, { exact: true });
    const clicked = await clickFirstVisible(locator);
    if (clicked) {
      await page.waitForTimeout(1000);
      return;
    }
  }
}

async function readJson(filePath, fallback) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error(`לא ניתן לקרוא את ${path.basename(filePath)}: ${error.message}`);
  }
}

async function loadActiveAd() {
  const env = await readLocalEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await supabase
    .from('ads')
    .select('id,body,image,published_at,status')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.log(`לא הצלחתי למשוך פרסומת פעילה מהמערכת: ${error.message}`);
    return null;
  }

  if (!data?.body && !data?.image) return null;

  return {
    id: data.id,
    body: data.body || '',
    imagePath: data.image ? await saveActiveAdImage(data.image) : '',
    publishedAt: data.published_at
  };
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

async function saveActiveAdImage(dataUrl) {
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return '';

  const mimeType = match[1];
  const base64 = match[2];
  const extByMime = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp'
  };
  const ext = extByMime[mimeType] || '.png';

  await fs.mkdir(CACHE_DIR, { recursive: true });
  const imagePath = path.join(CACHE_DIR, `active-ad${ext}`);
  await fs.writeFile(imagePath, Buffer.from(base64, 'base64'));
  return imagePath;
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function validateGroup(group, index) {
  if (!group || typeof group !== 'object') throw new Error(`קבוצה ${index + 1} לא תקינה.`);
  if (!group.name) throw new Error(`חסר name בקבוצה ${index + 1}.`);
  if (!group.url) throw new Error(`חסר url בקבוצה ${group.name}.`);
  if (!group.language) throw new Error(`חסר language בקבוצה ${group.name}.`);
}

function normalizeRoundArg(positionArgs) {
  const [first, second] = positionArgs;
  if (!first) return '';

  const cleanFirst = first.toLowerCase().replace(/\s+/g, '');
  if (cleanFirst === 'lap' && second) return `lap${String(second).replace(/\D/g, '')}`;
  return cleanFirst;
}

function getPostRound(activeRound) {
  // ה-laps מחלקים קבוצות, אבל משתמשים באותו טקסט של סבב הבוקר.
  return LAP_ROUNDS.has(activeRound) ? 'morning' : activeRound;
}

function getLapPlan(allGroups, activeRound) {
  if (!LAP_ROUNDS.has(activeRound)) {
    return {
      groups: allGroups,
      isLap: false,
      startIndex: 0,
      endIndex: allGroups.length
    };
  }

  const lapIndex = Number(activeRound.replace('lap', '')) - 1;
  const lapCount = LAP_ROUNDS.size;
  const baseSize = Math.floor(allGroups.length / lapCount);
  const remainder = allGroups.length % lapCount;
  const startIndex = lapIndex * baseSize + Math.min(lapIndex, remainder);
  const size = baseSize + (lapIndex < remainder ? 1 : 0);
  const endIndex = startIndex + size;

  return {
    groups: allGroups.slice(startIndex, endIndex),
    isLap: true,
    startIndex,
    endIndex
  };
}

function selectPostText(posts, activeRound, language) {
  const roundPosts = posts[activeRound] || {};
  const languagePosts = roundPosts[language] || roundPosts.default;

  if (!Array.isArray(languagePosts) || languagePosts.length === 0) {
    throw new Error(`אין וריאציות טקסט לשפה "${language}" בסבב "${activeRound}".`);
  }

  const index = Math.floor(Math.random() * languagePosts.length);
  return languagePosts[index];
}

function buildPreparedText(postText, link) {
  return [postText, link].filter(Boolean).join('\n\n');
}

async function copyToClipboard(text) {
  // העתקה ללוח דרך מערכת ההפעלה, כדי שהמשתמש יוכל להדביק ידנית במקרה הצורך.
  const platform = process.platform;

  if (platform === 'win32') {
    await pipeToCommand('powershell.exe', ['-NoProfile', '-Command', 'Set-Clipboard'], text);
    return;
  }

  if (platform === 'darwin') {
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

function printGroupInstructions({ group, round: activeRound, preparedText, imagePath, index, total }) {
  console.log('\n========================================');
  console.log(`קבוצה ${index + 1}/${total}`);
  console.log(`שם: ${group.name}`);
  console.log(`שפה: ${group.language}`);
  console.log(`סבב: ${activeRound}`);
  console.log(`קישור: ${group.url}`);
  console.log(`תמונה: ${imagePath || 'לא הוגדרה'}`);
  console.log(`לינק שצורף לפוסט: ${group.link || 'לא הוגדר'}`);
  console.log('----------------------------------------');
  console.log('הטקסט שיודבק בפייסבוק:');
  console.log(preparedText);
  console.log('----------------------------------------');
  console.log('אחרי שהטיוטה מוכנה: בדוק אותה ולחץ פרסום ידנית בלבד.');
}

async function askAction() {
  return rl.question('Enter = פרסמתי/מוכן להמשיך, s = דילוג, f = תקלה, q = יציאה: ');
}

async function waitForManualPublishOrFallback(page, preparedText) {
  console.log('ממתין שתלחץ פרסום בפייסבוק... אל תלחץ Enter אם הכל תקין.');

  const published = await waitForPublishCompletion(page, preparedText, 10 * 60_000);
  if (published) {
    console.log('הפרסום זוהה. ממשיך לקבוצה הבאה.');
    return 'prepared';
  }

  console.log('לא זוהתה סגירה של חלון הפוסט בזמן שהוגדר.');
  return normalizeAction(await askAction());
}

async function waitForPublishCompletion(page, preparedText, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const hasComposer = await hasVisiblePostComposer(page);
    if (!hasComposer) return true;

    // אחרי פרסום פייסבוק לפעמים פותח קומפוזר ריק חדש.
    // אם הטקסט שהכנו כבר לא מופיע בקומפוזר, מתייחסים לזה כסיום הפרסום.
    const stillHasPreparedText = await composerStillContainsPreparedText(page, preparedText);
    if (!stillHasPreparedText) return true;

    await delay(2000);
  }

  return false;
}

async function hasVisiblePostComposer(page) {
  const dialog = page.locator('div[role="dialog"]').filter({ hasText: /יצירת פוסט|Create post|פרסום|Post/i });
  const count = await dialog.count().catch(() => 0);

  for (let i = 0; i < count; i += 1) {
    try {
      if (await dialog.nth(i).isVisible({ timeout: 500 })) return true;
    } catch {
      // ממשיכים לבדוק דיאלוגים אחרים.
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
      // ממשיכים לבדוק חלונות אחרים.
    }
  }

  return false;
}

function normalizeAction(answer) {
  const clean = answer.trim().toLowerCase();

  if (clean === 'q') {
    console.log('המשתמש עצר את הסבב.');
    process.exit(0);
  }

  if (clean === 's') return 'skipped';
  if (clean === 'f') return 'failed';
  return 'prepared';
}

async function appendLog(entry) {
  const currentLog = await readJson(LOG_FILE, []);
  const nextLog = Array.isArray(currentLog) ? currentLog : [];
  nextLog.push(entry);
  await writeJson(LOG_FILE, nextLog);
}

async function wasPreparedRecently(groupUrl, windowMs) {
  const currentLog = await readJson(LOG_FILE, []);
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

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function randomDelayMs(devMode) {
  const min = devMode ? 5_000 : 3 * 60_000;
  const max = devMode ? 15_000 : 10 * 60_000;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatDelay(ms) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} שניות`;
  return `${Math.round(seconds / 60)} דקות`;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shortcutModifier() {
  return process.platform === 'darwin' ? 'Meta' : 'Control';
}

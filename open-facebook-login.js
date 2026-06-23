import { chromium } from 'playwright';
import path from 'node:path';

const PROFILE_DIR = process.env.FACEBOOK_PUBLISH_PROFILE_DIR
  ? path.resolve(process.env.FACEBOOK_PUBLISH_PROFILE_DIR)
  : path.join(process.cwd(), 'facebook-publish-profile-active');

const context = await chromium.launchPersistentContext(PROFILE_DIR, {
  headless: false,
  viewport: { width: 1366, height: 900 }
});

const page = context.pages()[0] || await context.newPage();
await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded' });

console.log('Facebook opened with the publishing profile.');
console.log('Login manually, choose the correct page, and keep this window connected.');
console.log('Close this terminal window only after you finish logging in.');

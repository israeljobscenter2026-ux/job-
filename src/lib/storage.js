// Tiny localStorage abstraction. When migrating to Supabase, swap the
// implementation of get/set/list with Supabase queries — the contract stays.
import { sha256 } from './hash.js';

const KEYS = {
  USERS: 'jls.users',
  LEADS: 'jls.leads',
  AREAS: 'jls.areas',
  TEMPLATES: 'jls.templates',
  ADS: 'jls.ads',
  SESSION: 'jls.session',
  SEEDED: 'jls.seeded.v1'
};

export const STORAGE_KEYS = KEYS;

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function write(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

export function getUsers() { return read(KEYS.USERS, []); }
export function setUsers(v) { write(KEYS.USERS, v); }

export function getLeads() { return read(KEYS.LEADS, []); }
export function setLeads(v) { write(KEYS.LEADS, v); }

export function getAreas() { return read(KEYS.AREAS, []); }
export function setAreas(v) { write(KEYS.AREAS, v); }

export function getTemplates() { return read(KEYS.TEMPLATES, null); }
export function setTemplates(v) { write(KEYS.TEMPLATES, v); }

export function getAds() { return read(KEYS.ADS, []); }
export function setAds(v) { write(KEYS.ADS, v); }

export function getSession() { return read(KEYS.SESSION, null); }
export function setSession(v) {
  if (v === null) localStorage.removeItem(KEYS.SESSION);
  else write(KEYS.SESSION, v);
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const STOCK_AREAS = [
  'אשדוד',
  'אשקלון',
  'באר שבע',
  'בית שמש',
  'בני ברק',
  'דימונה',
  'חדרה',
  'חולון',
  'חיפה',
  'טבריה',
  'טירת הכרמל',
  'יקום',
  'ירושלים',
  'ירושלים מרכזית',
  'כרמיאל',
  'נשר',
  'נתיבות',
  'נתניה',
  'סיין',
  'עכו',
  'עפולה',
  'פתח תקווה',
  'צפת',
  "צ'ק פוסט",
  'קדמת גליל טבריה',
  'קריית שמונה',
  'קריית אתא',
  'קריית גת',
  'קריית מוצקין',
  'ראשון לציון',
  'רחובות',
  'רמת גן',
  'תל אביב אנוש',
  'תל אביב מי אביבים',
  'עבודה מהבית'
];

// One-time seeding: default admin users + a few common areas.
// Default password for both admins: Admin123!
export async function seedIfNeeded() {
  if (!localStorage.getItem(KEYS.SEEDED)) {
    if (getUsers().length === 0) {
      const defaultHash = await sha256('Admin123!');
      const now = new Date().toISOString();
      setUsers([
        {
          id: uuid(),
          email: 'salameemel@gmail.com',
          name: 'סלאמה',
          passwordHash: defaultHash,
          createdAt: now
        },
        {
          id: uuid(),
          email: 'djelidor4@gmail.com',
          name: 'מנהל 2',
          passwordHash: defaultHash,
          createdAt: now
        }
      ]);
    }
    if (getAreas().length === 0) {
      setAreas(STOCK_AREAS.map((name) => ({ id: uuid(), name })));
    }
    localStorage.setItem(KEYS.SEEDED, '1');
  }
  // Always run versioned migrations (idempotent).
  ensureStockAreas();
}

// Merges the stock area list into the existing list (by name, no duplicates).
// Runs once per migration version. Users can still delete areas afterwards
// and they won't reappear on the next load.
function ensureStockAreas() {
  const flag = 'jls.migration.areas.v2';
  if (localStorage.getItem(flag)) return;
  const current = getAreas();
  const existingNames = new Set(current.map((a) => a.name));
  const additions = STOCK_AREAS
    .filter((name) => !existingNames.has(name))
    .map((name) => ({ id: uuid(), name }));
  if (additions.length) setAreas([...current, ...additions]);
  localStorage.setItem(flag, '1');
}

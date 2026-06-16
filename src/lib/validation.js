// Israeli phone number validation: must start with 05 and be 10 digits total.
export function isValidIsraeliMobile(input) {
  if (!input) return false;
  const digits = String(input).replace(/\D/g, '');
  return /^05\d{8}$/.test(digits);
}

export function normalizePhone(input) {
  return String(input || '').replace(/\D/g, '');
}

// Israeli ID validation (Teudat Zehut) with Luhn-like algorithm.
export function isValidIsraeliId(input) {
  if (!input) return false;
  const digits = String(input).replace(/\D/g, '');
  if (digits.length < 5 || digits.length > 9) return false;
  const padded = digits.padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let num = Number(padded[i]) * ((i % 2) + 1);
    if (num > 9) num -= 9;
    sum += num;
  }
  return sum % 10 === 0;
}

export function normalizeId(input) {
  return String(input || '').replace(/\D/g, '');
}

export function isNonEmpty(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

export function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
}

// Basic XSS guard for free-text fields stored locally
export function sanitizeText(v) {
  return String(v || '')
    .replace(/[<>]/g, (c) => (c === '<' ? '&lt;' : '&gt;'))
    .slice(0, 5000);
}

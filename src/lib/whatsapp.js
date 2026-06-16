import { normalizePhone } from './validation.js';

export const TEMPLATE_KEYS = {
  INITIAL: 'initial',
  SENT: 'sent',
  HIRED: 'hired',
  TWO_MONTHS_CHECK: 'two_months_check',
  IRRELEVANT: 'irrelevant'
};

export const DEFAULT_TEMPLATES = {
  [TEMPLATE_KEYS.INITIAL]: {
    title: 'הודעה ראשונית',
    body: 'היי {שם פרטי}, תודה שהשארת פרטים למשרה. אשמח להעביר לך פרטים נוספים לגבי העבודה באזור {אזור/אתר}.'
  },
  [TEMPLATE_KEYS.SENT]: {
    title: 'פרטים נשלחו',
    body: 'היי {שם פרטי}, שלחתי לך את פרטי המשרה. אשמח לדעת אם זה עדיין רלוונטי עבורך.'
  },
  [TEMPLATE_KEYS.HIRED]: {
    title: 'התקבל לעבודה',
    body: 'היי {שם פרטי}, שמחים שהתקבלת לעבודה. מאחלים לך המון הצלחה!'
  },
  [TEMPLATE_KEYS.TWO_MONTHS_CHECK]: {
    title: 'בדיקה אחרי חודשיים',
    body: 'היי {שם פרטי}, רציתי לבדוק אם אתה עדיין עובד באתר {אזור/אתר} והכול מתקדם כמו שצריך.'
  },
  [TEMPLATE_KEYS.IRRELEVANT]: {
    title: 'לא רלוונטי',
    body: 'היי {שם פרטי}, תודה על הזמן שלך. אם בעתיד המשרה תחזור להיות רלוונטית עבורך, אשמח לעזור.'
  }
};

export function fillTemplate(template, lead) {
  if (!template) return '';
  return template
    .replaceAll('{שם פרטי}', lead?.firstName || '')
    .replaceAll('{שם משפחה}', lead?.lastName || '')
    .replaceAll('{אזור/אתר}', lead?.area || '')
    .replaceAll('{אזור מגורים}', lead?.area || '')
    .replaceAll('{טלפון}', lead?.phone || '');
}

export function buildWhatsappUrl(phone, message) {
  const digits = normalizePhone(phone);
  // wa.me expects international format. IL numbers like 05XXXXXXXX -> 9725XXXXXXXX
  let intl = digits;
  if (digits.startsWith('0')) {
    intl = '972' + digits.slice(1);
  } else if (!digits.startsWith('972')) {
    intl = '972' + digits;
  }
  const text = encodeURIComponent(message || '');
  return `https://wa.me/${intl}?text=${text}`;
}

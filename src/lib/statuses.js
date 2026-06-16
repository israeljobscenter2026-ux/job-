export const STATUSES = {
  NEW: 'new',
  SENT: 'sent',
  HIRED: 'hired',
  TWO_MONTHS: 'two_months',
  REJECTED: 'rejected'
};

export const STATUS_ORDER = [
  STATUSES.NEW,
  STATUSES.SENT,
  STATUSES.HIRED,
  STATUSES.TWO_MONTHS,
  STATUSES.REJECTED
];

export const STATUS_LABELS = {
  [STATUSES.NEW]: 'חדש',
  [STATUSES.SENT]: 'פרטים נשלחו',
  [STATUSES.HIRED]: 'התקבל לעבודה',
  [STATUSES.TWO_MONTHS]: 'עבר חודשיים',
  [STATUSES.REJECTED]: 'לא התקבל / לא מעוניין'
};

export const STATUS_COLORS = {
  [STATUSES.NEW]: 'bg-sky-100 text-sky-800 border border-sky-200',
  [STATUSES.SENT]: 'bg-amber-100 text-amber-800 border border-amber-200',
  [STATUSES.HIRED]: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  [STATUSES.TWO_MONTHS]: 'bg-violet-100 text-violet-800 border border-violet-200',
  [STATUSES.REJECTED]: 'bg-rose-100 text-rose-800 border border-rose-200'
};

export const JOB_TYPES = {
  BACK_OFFICE: 'back_office',
  CUSTOMER_SERVICE: 'customer_service',
  TECH_SUPPORT: 'tech_support'
};

export const JOB_TYPE_LABELS = {
  [JOB_TYPES.BACK_OFFICE]: 'בק אופיס',
  [JOB_TYPES.CUSTOMER_SERVICE]: 'שירות לקוחות טלפוני',
  [JOB_TYPES.TECH_SUPPORT]: 'מוקד תמיכה טכנית טלפוני'
};

export const JOB_TYPE_LIST = [
  JOB_TYPES.BACK_OFFICE,
  JOB_TYPES.CUSTOMER_SERVICE,
  JOB_TYPES.TECH_SUPPORT
];

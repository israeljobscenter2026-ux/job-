import { useState } from 'react';
import { useData } from '../contexts/DataContext.jsx';
import {
  isValidIsraeliMobile,
  normalizePhone,
  isValidIsraeliId,
  normalizeId,
  isNonEmpty
} from '../lib/validation.js';
import { JOB_TYPE_LABELS, JOB_TYPE_LIST, JOB_TYPES } from '../lib/statuses.js';

const JOB_META = {
  [JOB_TYPES.BACK_OFFICE]: {
    title: 'בק אופיס',
    desc: 'עבודה משרדית מסודרת',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 10h18"/><path d="M8 18v3M16 18v3"/>
      </svg>
    )
  },
  [JOB_TYPES.CUSTOMER_SERVICE]: {
    title: 'שירות לקוחות',
    desc: 'מענה טלפוני ללקוחות',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M3 11a9 9 0 0118 0v6a3 3 0 01-3 3h-1v-7h4M3 11v6a3 3 0 003 3h1v-7H3"/>
      </svg>
    )
  },
  [JOB_TYPES.TECH_SUPPORT]: {
    title: 'תמיכה טכנית',
    desc: 'פתרון בעיות טכניות',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
        <path d="M12 2a4 4 0 014 4v2h1a3 3 0 013 3v4a3 3 0 01-3 3h-1v-2h1a1 1 0 001-1v-4a1 1 0 00-1-1h-1V6a2 2 0 10-4 0v2h-1V6a4 4 0 014-4z"/>
        <path d="M7 8h1v8H7a3 3 0 01-3-3v-2a3 3 0 013-3z"/>
      </svg>
    )
  }
};

export default function LandingPage() {
  const { areas, createLead } = useData();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    idNumber: '',
    area: '',
    jobType: '',
    consent: false
  });
  const [errors, setErrors] = useState({});

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const e = {};
    if (!isNonEmpty(form.firstName)) e.firstName = 'יש להזין שם פרטי';
    if (!isNonEmpty(form.lastName)) e.lastName = 'יש להזין שם משפחה';
    if (!isValidIsraeliMobile(form.phone)) e.phone = 'מספר נייד ישראלי תקין (05XXXXXXXX)';
    if (!isValidIsraeliId(form.idNumber)) e.idNumber = 'תעודת זהות אינה תקינה';
    if (!isNonEmpty(form.area)) e.area = 'יש לבחור אזור / אתר';
    if (!form.jobType) e.jobType = 'יש לבחור סוג משרה';
    if (!form.consent) e.consent = 'יש לאשר את ההסכמה כדי להמשיך';
    return e;
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    try {
      createLead({
        ...form,
        phone: normalizePhone(form.phone),
        idNumber: normalizeId(form.idNumber)
      });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <BackgroundDecor />

      <header className="relative px-4 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-grad-brand grid place-items-center text-white font-bold shadow-glow">L</div>
          <div className="leading-tight">
            <div className="font-bold text-slate-900">משרות חמות</div>
            <div className="text-xs text-slate-500">בק אופיס · מוקדים · שירות לקוחות</div>
          </div>
        </div>
      </header>

      <main className="relative max-w-6xl mx-auto px-4 pb-16">
        <section className="grid md:grid-cols-12 gap-8 lg:gap-12 items-start pt-4 md:pt-10">
          {/* Hero text */}
          <div className="md:col-span-5 md:order-1 animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              מגייסים עכשיו · מענה תוך 24 שעות
            </span>

            <h1 className="mt-5 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-balance">
              העבודה הבאה שלך
              <br />
              <span className="grad-text">מתחילה כאן.</span>
            </h1>

            <p className="mt-4 md:mt-5 text-slate-600 text-base md:text-lg leading-relaxed max-w-md text-pretty">
              משרות איכותיות בבק אופיס, שירות לקוחות ומוקדי תמיכה טכנית — עם תנאים מצוינים והכשרה מלאה.
            </p>

            <ul className="mt-6 md:mt-8 space-y-2.5 text-sm md:text-base">
              {[
                'תנאים מצוינים והכשרה מלאה',
                'משרות גם למתחילים וגם לבעלי ניסיון',
                'אזורים שונים ברחבי הארץ + עבודה מהבית'
              ].map((t) => (
                <li key={t} className="flex items-center gap-3 text-slate-700">
                  <CheckBubble /> <span>{t}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8 flex items-center gap-4">
              <AvatarStack />
              <div className="text-sm text-slate-600 leading-tight">
                <div className="font-semibold text-slate-900">מאות מועמדים</div>
                כבר התקבלו לעבודה דרכנו
              </div>
            </div>
          </div>

          {/* Form card */}
          <div className="md:col-span-7 md:order-2 animate-fade-up [animation-delay:60ms]">
            <div className="relative">
              <div aria-hidden className="absolute -inset-1 bg-grad-brand opacity-20 blur-2xl rounded-3xl" />
              <div className="relative card p-5 sm:p-7 md:p-8 backdrop-blur-sm bg-white/95">
                {submitted ? (
                  <SuccessMessage onAgain={() => {
                    setForm({ firstName: '', lastName: '', phone: '', idNumber: '', area: '', jobType: '', consent: false });
                    setSubmitted(false);
                  }} />
                ) : (
                  <form onSubmit={onSubmit} noValidate>
                    <div className="flex items-center justify-between mb-5">
                      <h2 className="text-xl md:text-2xl font-bold">השארת פרטים</h2>
                      <span className="text-xs text-slate-500">לוקח 30 שניות</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="שם פרטי" error={errors.firstName} required>
                        <input
                          className="input"
                          value={form.firstName}
                          onChange={(e) => update('firstName', e.target.value)}
                          autoComplete="given-name"
                          maxLength={50}
                          required
                        />
                      </Field>
                      <Field label="שם משפחה" error={errors.lastName} required>
                        <input
                          className="input"
                          value={form.lastName}
                          onChange={(e) => update('lastName', e.target.value)}
                          autoComplete="family-name"
                          maxLength={50}
                          required
                        />
                      </Field>
                      <Field label="טלפון נייד" error={errors.phone} required>
                        <input
                          className="input"
                          type="tel"
                          inputMode="numeric"
                          placeholder="05XXXXXXXX"
                          value={form.phone}
                          onChange={(e) => update('phone', e.target.value)}
                          autoComplete="tel"
                          maxLength={15}
                          required
                        />
                      </Field>
                      <Field label="תעודת זהות" error={errors.idNumber} required>
                        <input
                          className="input"
                          inputMode="numeric"
                          value={form.idNumber}
                          onChange={(e) => update('idNumber', e.target.value)}
                          maxLength={9}
                          required
                        />
                      </Field>
                      <div className="sm:col-span-2">
                        <Field label="אזור מגורים / אתר" error={errors.area} required>
                          <select
                            className="input"
                            value={form.area}
                            onChange={(e) => update('area', e.target.value)}
                            required
                          >
                            <option value="">בחר/י אזור</option>
                            {areas.map((a) => (
                              <option key={a.id} value={a.name}>{a.name}</option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    </div>

                    {/* Visual job picker */}
                    <div className="mt-4">
                      <div className="label">
                        סוג משרה מבוקשת <span className="text-rose-600 mr-0.5">*</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {JOB_TYPE_LIST.map((key) => {
                          const meta = JOB_META[key];
                          const active = form.jobType === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => update('jobType', key)}
                              className={`group text-right rounded-xl border p-3 transition focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200/60 ${
                                active
                                  ? 'border-brand-500 bg-brand-50 shadow-glow'
                                  : 'border-slate-200 bg-white hover:border-brand-300 hover:bg-brand-50/40'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className={`h-10 w-10 rounded-lg grid place-items-center transition ${
                                  active ? 'bg-grad-brand text-white' : 'bg-slate-100 text-slate-600 group-hover:bg-brand-100 group-hover:text-brand-700'
                                }`}>
                                  {meta.icon}
                                </div>
                                <div className="min-w-0">
                                  <div className={`font-semibold text-sm ${active ? 'text-brand-800' : 'text-slate-900'}`}>{meta.title}</div>
                                  <div className="text-xs text-slate-500 truncate">{meta.desc}</div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {errors.jobType && <p className="mt-1 text-xs text-rose-600">{errors.jobType}</p>}
                    </div>

                    {/* Consent */}
                    <label className={`mt-5 flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                      errors.consent ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                    }`}>
                      <input
                        type="checkbox"
                        className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-400"
                        checked={form.consent}
                        onChange={(e) => update('consent', e.target.checked)}
                      />
                      <span className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                        אני מסכים/ה כי הפרטים שמסרתי ישמשו ליצירת קשר לצורך מציאת עבודה בלבד,
                        בהתאם לחוק הגנת הפרטיות, התשמ"א-1981.
                      </span>
                    </label>
                    {errors.consent && (
                      <p className="mt-1 text-xs text-rose-600">{errors.consent}</p>
                    )}

                    <button type="submit" className="btn-primary-grad w-full mt-4 !py-3 text-base" disabled={submitting}>
                      {submitting ? 'שולח...' : (
                        <>
                          שליחת פרטים
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>
                          </svg>
                        </>
                      )}
                    </button>

                    <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500">
                      <LockIcon /> הפרטים שלך מאובטחים ולא נמסרים לצד שלישי
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative text-center text-xs text-slate-500 py-6">
        © {new Date().getFullYear()} מערכת לידים – כל הזכויות שמורות
      </footer>
    </div>
  );
}

function BackgroundDecor() {
  return (
    <>
      <div aria-hidden className="absolute inset-0 bg-mesh pointer-events-none" />
      <div aria-hidden className="absolute -top-32 -right-32 h-80 w-80 rounded-full bg-brand-300/30 blur-3xl animate-blob" />
      <div aria-hidden className="absolute top-40 -left-32 h-80 w-80 rounded-full bg-accent-400/25 blur-3xl animate-blob [animation-delay:-6s]" />
      <div aria-hidden className="absolute bottom-0 right-1/3 h-72 w-72 rounded-full bg-fuchsia-300/20 blur-3xl animate-blob [animation-delay:-12s]" />
    </>
  );
}

function Field({ label, error, children, required }) {
  return (
    <label className="block">
      <span className="label">
        {label}
        {required && <span className="text-rose-600 mr-0.5">*</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

function CheckBubble() {
  return (
    <span className="inline-grid place-items-center h-7 w-7 rounded-full bg-grad-brand text-white shadow-glow shrink-0">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4L19 7"/></svg>
    </span>
  );
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
      <rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>
    </svg>
  );
}

function AvatarStack() {
  const colors = ['from-fuchsia-400 to-rose-500', 'from-amber-400 to-orange-500', 'from-emerald-400 to-teal-500', 'from-brand-400 to-accent-500'];
  return (
    <div className="flex -space-x-2 space-x-reverse">
      {colors.map((c, i) => (
        <span key={i} className={`h-9 w-9 rounded-full bg-gradient-to-br ${c} border-2 border-white shadow`} />
      ))}
    </div>
  );
}

function SuccessMessage({ onAgain }) {
  return (
    <div className="text-center py-6 animate-pop-in">
      <div className="mx-auto mb-5 relative h-20 w-20">
        <div className="absolute inset-0 rounded-full bg-emerald-100 animate-ping opacity-50" />
        <div className="relative h-20 w-20 rounded-full bg-grad-brand grid place-items-center text-white shadow-glow">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4 4L19 7"/></svg>
        </div>
      </div>
      <h3 className="text-2xl font-bold">הפרטים התקבלו בהצלחה</h3>
      <p className="mt-2 text-slate-600">נחזור אליך בהקדם עם כל המידע על המשרה.</p>
      <button onClick={onAgain} className="btn-secondary mt-6">שליחת טופס נוסף</button>
    </div>
  );
}

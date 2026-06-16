import { Link } from 'react-router-dom';
import { useData } from '../contexts/DataContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { STATUSES, STATUS_LABELS, STATUS_COLORS, JOB_TYPE_LABELS } from '../lib/statuses.js';
import StatusBadge from '../components/StatusBadge.jsx';
import LeadListItem from '../components/LeadListItem.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const { leads, stats, remindersDue } = useData();
  const recent = [...leads].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'בוקר טוב';
    if (h < 18) return 'צהריים טובים';
    return 'ערב טוב';
  })();
  const firstName = (user?.name || user?.email || '').split(' ')[0] || '';

  // Stat tiles — bar classes hardcoded so Tailwind JIT picks them up.
  const tiles = [
    { label: 'חדש', value: stats.byStatus[STATUSES.NEW] || 0, bar: 'bg-sky-500', status: STATUSES.NEW },
    { label: 'פרטים נשלחו', value: stats.byStatus[STATUSES.SENT] || 0, bar: 'bg-amber-500', status: STATUSES.SENT },
    { label: 'התקבלו', value: stats.byStatus[STATUSES.HIRED] || 0, bar: 'bg-emerald-500', status: STATUSES.HIRED },
    { label: 'עבר חודשיים', value: stats.byStatus[STATUSES.TWO_MONTHS] || 0, bar: 'bg-violet-500', status: STATUSES.TWO_MONTHS },
    { label: 'לא רלוונטי', value: stats.byStatus[STATUSES.REJECTED] || 0, bar: 'bg-rose-500', status: STATUSES.REJECTED }
  ];
  const maxTile = Math.max(1, ...tiles.map((t) => t.value));

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Hero header */}
      <header className="relative overflow-hidden rounded-2xl bg-grad-brand text-white p-6 md:p-8 shadow-lift">
        <div aria-hidden className="absolute -top-10 -left-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="absolute -bottom-10 right-1/3 h-40 w-40 rounded-full bg-fuchsia-300/30 blur-2xl" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="text-sm/relaxed text-white/80">{greeting}{firstName && `, ${firstName}`}</div>
            <h1 className="mt-1 text-2xl md:text-3xl font-extrabold tracking-tight">
              {stats.total === 0 ? 'עוד לא נכנסו פונים' : `${stats.total} פונים במערכת`}
            </h1>
            <p className="mt-1 text-sm text-white/80">
              {remindersDue.length > 0
                ? `${remindersDue.length} תזכורות ממתינות לבדיקה אחרי חודשיים.`
                : 'הכול מסודר — אין תזכורות פתוחות.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/leads" className="inline-flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur px-4 py-2.5 text-sm font-semibold border border-white/20 transition">
              לכל הפונים
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
            </Link>
            {remindersDue.length > 0 && (
              <Link to="/admin/reminders" className="inline-flex items-center gap-2 rounded-xl bg-white text-brand-700 hover:bg-slate-100 px-4 py-2.5 text-sm font-semibold transition">
                תזכורות
                <span className="badge bg-rose-100 text-rose-700">{remindersDue.length}</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Stat tiles with mini bars */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="card-hover p-4 relative overflow-hidden">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-2xl md:text-3xl font-extrabold tracking-tight">{t.value}</div>
              <StatusBadge status={t.status} />
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{t.label}</div>
            <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full ${t.bar} transition-all duration-700`}
                style={{ width: `${Math.round((t.value / maxTile) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </section>

      <section className="grid lg:grid-cols-3 gap-4">
        {/* Reminders */}
        <div className="card p-5 lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">תזכורות לבדיקה</h2>
            <span className={`badge ${remindersDue.length > 0 ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-600'}`}>
              {remindersDue.length}
            </span>
          </div>
          {remindersDue.length === 0 ? (
            <div className="text-center py-6">
              <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-emerald-100 grid place-items-center text-emerald-600">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12l4 4L19 7"/></svg>
              </div>
              <p className="text-sm text-slate-500">אין תזכורות פתוחות.<br />עובדים שהתקבלו יופיעו כאן לאחר חודשיים.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {remindersDue.slice(0, 6).map((l) => (
                <li key={l.id}>
                  <Link to={`/admin/leads/${l.id}`} className="flex items-center justify-between rounded-xl bg-rose-50/60 hover:bg-rose-50 border border-rose-100 px-3 py-2.5 transition">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm truncate">{l.firstName} {l.lastName}</div>
                      <div className="text-xs text-slate-500 truncate">{l.area} · קליטה {fmtDate(l.hireDate)}</div>
                    </div>
                    <span className="text-xs text-rose-700 font-medium shrink-0">לבדיקה</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {remindersDue.length > 6 && (
            <div className="mt-3">
              <Link to="/admin/reminders" className="text-sm text-brand-700 hover:underline font-medium">לכל התזכורות ←</Link>
            </div>
          )}
        </div>

        {/* Recent leads */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">פונים אחרונים</h2>
            <Link to="/admin/leads" className="text-sm text-brand-700 hover:underline font-medium">הצג הכול ←</Link>
          </div>
          {recent.length === 0 ? (
            <div className="text-center py-10">
              <div className="mx-auto mb-3 h-14 w-14 rounded-full bg-grad-brand-soft grid place-items-center text-brand-600">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              </div>
              <p className="text-sm text-slate-500">עדיין לא נכנסו פונים.<br />ברגע שמישהו ימלא את דף הנחיתה, הוא יופיע כאן.</p>
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="md:hidden space-y-2">
                {recent.map((l) => <LeadListItem key={l.id} lead={l} />)}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-right text-slate-500 text-xs uppercase tracking-wide">
                      <th className="py-2 font-semibold">שם</th>
                      <th className="py-2 font-semibold">סוג משרה</th>
                      <th className="py-2 font-semibold">אזור</th>
                      <th className="py-2 font-semibold">סטטוס</th>
                      <th className="py-2 font-semibold">נכנס</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recent.map((l) => (
                      <tr key={l.id} className="hover:bg-slate-50 transition">
                        <td className="py-3">
                          <Link to={`/admin/leads/${l.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
                            {l.firstName} {l.lastName}
                          </Link>
                        </td>
                        <td className="py-3 text-slate-600">{JOB_TYPE_LABELS[l.jobType] || '-'}</td>
                        <td className="py-3 text-slate-600">{l.area}</td>
                        <td className="py-3"><StatusBadge status={l.status} /></td>
                        <td className="py-3 text-slate-500">{fmtDate(l.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('he-IL');
}

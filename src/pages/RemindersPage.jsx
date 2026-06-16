import { Link } from 'react-router-dom';
import { useData } from '../contexts/DataContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { STATUSES, JOB_TYPE_LABELS } from '../lib/statuses.js';

export default function RemindersPage() {
  const { remindersDue, updateLead } = useData();
  const { user } = useAuth();
  const actor = user?.name || user?.email || 'מנהל';

  function markPassed(id) {
    updateLead(id, { status: STATUSES.TWO_MONTHS }, actor);
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">תזכורות לבדיקה אחרי חודשיים</h1>
        <p className="text-slate-500 text-sm">
          רשימת עובדים שעברו חודשיים ממועד הקליטה. לאחר בדיקה ניתן לסמן כ"עבר חודשיים".
        </p>
      </header>

      {remindersDue.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">אין כרגע תזכורות פתוחות.</div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="md:hidden space-y-2">
            {remindersDue.map((l) => {
              const days = Math.floor((Date.now() - new Date(l.hireDate).getTime()) / 86400000);
              return (
                <div key={l.id} className="rounded-xl border border-rose-100 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link to={`/admin/leads/${l.id}`} className="font-semibold text-brand-700 hover:underline">
                        {l.firstName} {l.lastName}
                      </Link>
                      <div className="text-xs text-slate-500 mt-1">{JOB_TYPE_LABELS[l.jobType] || '-'} · {l.area}</div>
                    </div>
                    <span className="badge bg-rose-100 text-rose-700 border border-rose-200">לבדיקה</span>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    קליטה: {new Date(l.hireDate).toLocaleDateString('he-IL')} · חלפו {days} ימים
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link to={`/admin/leads/${l.id}`} className="btn-secondary text-xs">פתח כרטיס</Link>
                    <button className="btn-primary text-xs" onClick={() => markPassed(l.id)}>סמן עבר חודשיים</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr className="text-right">
                  <th className="px-4 py-3 font-medium">שם</th>
                  <th className="px-4 py-3 font-medium">אזור / אתר</th>
                  <th className="px-4 py-3 font-medium">סוג משרה</th>
                  <th className="px-4 py-3 font-medium">תאריך קליטה</th>
                  <th className="px-4 py-3 font-medium">חלפו</th>
                  <th className="px-4 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {remindersDue.map((l) => {
                  const days = Math.floor((Date.now() - new Date(l.hireDate).getTime()) / 86400000);
                  return (
                    <tr key={l.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium">
                        <Link to={`/admin/leads/${l.id}`} className="text-brand-700 hover:underline">
                          {l.firstName} {l.lastName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{l.area}</td>
                      <td className="px-4 py-3">{JOB_TYPE_LABELS[l.jobType] || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{new Date(l.hireDate).toLocaleDateString('he-IL')}</td>
                      <td className="px-4 py-3">{days} ימים</td>
                      <td className="px-4 py-3 text-left">
                        <div className="flex justify-end gap-2">
                          <Link to={`/admin/leads/${l.id}`} className="btn-secondary !py-1 !px-2 text-xs">פתח כרטיס</Link>
                          <button className="btn-primary !py-1 !px-2 text-xs" onClick={() => markPassed(l.id)}>סמן עבר חודשיים</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </div>
        </>
      )}
    </div>
  );
}

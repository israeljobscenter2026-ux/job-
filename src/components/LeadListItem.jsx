import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge.jsx';
import { JOB_TYPE_LABELS, STATUSES } from '../lib/statuses.js';
import { getLeadJobTitle } from '../lib/jobCatalog.js';

const TWO_MONTHS_MS = 1000 * 60 * 60 * 24 * 60;

export default function LeadListItem({ lead, extraBadge }) {
  const needsReminder = lead.status === STATUSES.HIRED && lead.hireDate &&
    Date.now() - new Date(lead.hireDate).getTime() >= TWO_MONTHS_MS;
  const created = new Date(lead.createdAt).toLocaleDateString('he-IL');
  const initials = `${(lead.firstName || '?').slice(0, 1)}${(lead.lastName || '').slice(0, 1)}`.toUpperCase();
  const location = [lead.area, lead.city].filter(Boolean).join(' / ');
  const job = [lead.project, getLeadJobTitle(lead) || JOB_TYPE_LABELS[lead.jobType]].filter(Boolean).join(' - ');
  return (
    <Link
      to={`/admin/leads/${lead.id}`}
      className="group block rounded-2xl border border-slate-200 bg-white p-4 hover:border-brand-300 hover:shadow-card active:scale-[0.99] transition"
    >
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 rounded-xl bg-grad-brand-soft text-brand-700 grid place-items-center font-bold text-sm shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900 truncate group-hover:text-brand-700 transition">
              {lead.firstName} {lead.lastName}
            </span>
            {needsReminder && (
              <span className="badge bg-rose-100 text-rose-700 border border-rose-200">לבדיקה</span>
            )}
            {extraBadge}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 truncate">{job || '-'} · {location || '-'}</div>
        </div>
        <StatusBadge status={lead.status} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <a
          href={`tel:${lead.phone}`}
          onClick={(e) => e.stopPropagation()}
          className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 font-mono text-slate-700 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 text-center ltr-cell transition"
        >
          {lead.phone}
        </a>
        <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-slate-500 text-center">
          נכנס {created}
        </div>
      </div>
    </Link>
  );
}

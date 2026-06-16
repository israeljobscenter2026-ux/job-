import { STATUS_COLORS, STATUS_LABELS } from '../lib/statuses.js';

export default function StatusBadge({ status }) {
  const cls = STATUS_COLORS[status] || 'bg-slate-100 text-slate-700 border border-slate-200';
  return <span className={`badge ${cls}`}>{STATUS_LABELS[status] || status}</span>;
}

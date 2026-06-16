import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../contexts/DataContext.jsx';
import {
  STATUSES,
  STATUS_LABELS,
  STATUS_ORDER,
  JOB_TYPE_LABELS,
  JOB_TYPE_LIST
} from '../lib/statuses.js';
import StatusBadge from '../components/StatusBadge.jsx';
import LeadListItem from '../components/LeadListItem.jsx';

const TWO_MONTHS_MS = 1000 * 60 * 60 * 24 * 60;

export default function LeadsPage() {
  const { leads, areas } = useData();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [area, setArea] = useState('all');
  const [jobType, setJobType] = useState('all');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return leads
      .filter((l) => {
        if (status !== 'all' && l.status !== status) return false;
        if (area !== 'all' && l.area !== area) return false;
        if (jobType !== 'all' && l.jobType !== jobType) return false;
        if (needle) {
          const hay = [l.firstName, l.lastName, l.phone, l.idNumber, l.area].join(' ').toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [leads, q, status, area, jobType]);

  return (
    <div className="space-y-5 animate-fade-up">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">פונים</h1>
          <p className="text-slate-500 text-sm">{filtered.length} מתוך {leads.length} פונים</p>
        </div>
      </header>

      <div className="card p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <label className="label">חיפוש</label>
            <div className="relative">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                className="input pr-9"
                placeholder="שם, טלפון או ת.ז"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="label">סטטוס</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">הכול</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">אזור / אתר</label>
            <select className="input" value={area} onChange={(e) => setArea(e.target.value)}>
              <option value="all">הכול</option>
              {areas.map((a) => (
                <option key={a.id} value={a.name}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">סוג משרה</label>
            <select className="input" value={jobType} onChange={(e) => setJobType(e.target.value)}>
              <option value="all">הכול</option>
              {JOB_TYPE_LIST.map((j) => (
                <option key={j} value={j}>{JOB_TYPE_LABELS[j]}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center text-slate-500">לא נמצאו פונים תואמים.</div>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((l) => <LeadListItem key={l.id} lead={l} />)}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50/70 text-slate-500 text-xs uppercase tracking-wider">
                  <tr className="text-right">
                    <th className="px-4 py-3 font-semibold">שם</th>
                    <th className="px-4 py-3 font-semibold">טלפון</th>
                    <th className="px-4 py-3 font-semibold">ת.ז</th>
                    <th className="px-4 py-3 font-semibold">אזור</th>
                    <th className="px-4 py-3 font-semibold">סוג משרה</th>
                    <th className="px-4 py-3 font-semibold">סטטוס</th>
                    <th className="px-4 py-3 font-semibold">נכנס</th>
                    <th className="px-4 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((l) => {
                    const needsReminder = l.status === STATUSES.HIRED && l.hireDate &&
                      Date.now() - new Date(l.hireDate).getTime() >= TWO_MONTHS_MS;
                    return (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {needsReminder && (
                              <span title="דרושה בדיקה אחרי חודשיים" className="inline-grid place-items-center h-6 w-6 rounded-full bg-rose-100 text-rose-700">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
                              </span>
                            )}
                            <Link to={`/admin/leads/${l.id}`} className="font-medium text-brand-700 hover:underline">
                              {l.firstName} {l.lastName}
                            </Link>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono ltr-cell">{l.phone}</td>
                        <td className="px-4 py-3 font-mono ltr-cell">{l.idNumber}</td>
                        <td className="px-4 py-3">{l.area}</td>
                        <td className="px-4 py-3">{JOB_TYPE_LABELS[l.jobType] || '-'}</td>
                        <td className="px-4 py-3"><StatusBadge status={l.status} /></td>
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(l.createdAt)}</td>
                        <td className="px-4 py-3 text-left">
                          <Link to={`/admin/leads/${l.id}`} className="btn-ghost !py-1 !px-2 text-xs">פתח כרטיס</Link>
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

function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('he-IL');
}

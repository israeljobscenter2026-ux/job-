import { useMemo, useState } from 'react';
import { useData } from '../contexts/DataContext.jsx';

const REGION_OPTIONS = [
  { value: 'auto', label: 'זיהוי אוטומטי' },
  { value: 'north', label: 'צפון' },
  { value: 'center', label: 'מרכז' },
  { value: 'jerusalem', label: 'ירושלים והסביבה' },
  { value: 'south', label: 'דרום' },
  { value: 'sharon', label: 'השרון' },
  { value: 'allcountry', label: 'כל הארץ' }
];

export default function PublisherGroupsPage() {
  const { publisherGroups, addPublisherGroup, refreshData } = useData();
  const [form, setForm] = useState({ name: '', url: '', region: 'auto' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [scanBusy, setScanBusy] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanError, setScanError] = useState('');

  const grouped = useMemo(() => {
    const next = Object.fromEntries(REGION_OPTIONS.filter((region) => region.value !== 'auto').map((region) => [region.value, []]));
    for (const group of publisherGroups) {
      const region = next[group.region] ? group.region : 'center';
      next[region].push(group);
    }
    for (const key of Object.keys(next)) {
      next[key].sort((a, b) => a.name.localeCompare(b.name, 'he'));
    }
    return next;
  }, [publisherGroups]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function onAdd(ev) {
    ev.preventDefault();
    if (!form.name.trim() || !form.url.trim()) return;
    setBusy(true);
    setMessage('');
    try {
      await addPublisherGroup(form);
      setForm({ name: '', url: '', region: form.region });
      setMessage('הקבוצה נוספה למערכת ולבוט.');
    } catch (error) {
      setMessage(error.message || 'לא הצלחנו להוסיף את הקבוצה.');
    } finally {
      setBusy(false);
    }
  }

  async function runFacebookScan() {
    setScanBusy(true);
    setScanResult(null);
    setScanError('');

    try {
      const response = await fetch('http://127.0.0.1:4545/scan-facebook-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'לא הצלחנו להריץ את הסריקה.');
      }

      setScanResult(payload);
      await refreshData();
    } catch (error) {
      const isConnectionError = error instanceof TypeError;
      setScanError(isConnectionError
        ? 'כדי להריץ סריקה יש להפעיל קודם את השירות המקומי: npm run scan:server'
        : error.message || 'לא הצלחנו להריץ את הסריקה.');
    } finally {
      setScanBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">ניהול קבוצות פרסום</h1>
          <p className="text-slate-500 text-sm">הקבוצות מסודרות לפי אזורים. קבוצה חדשה שתתווסף כאן תיכנס גם להרצות של הבוט.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={runFacebookScan} disabled={scanBusy}>
          {scanBusy ? 'סורק קבוצות...' : ' סרוק קבוצות מפייסבוק'}
        </button>
      </header>

      <section className="card p-4 bg-slate-50">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-bold text-slate-900">סריקה אוטומטית מפייסבוק</h2>
            <p className="text-sm text-slate-500">הפעל את השירות המקומי פעם אחת במחשב, ואז אפשר להריץ את הסריקה מהכפתור במסך.</p>
            {scanResult && (
              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                נמצאו {scanResult.found} קבוצות · נוספו {scanResult.added} קבוצות חדשות · דולגו {scanResult.skipped} קבוצות קיימות
              </div>
            )}
            {scanError && (
              <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                {scanError}
              </div>
            )}
          </div>
          <code dir="ltr" className="rounded-md bg-slate-950 px-3 py-2 text-left text-xs font-semibold text-white">
            npm run scan:server
          </code>
        </div>
      </section>

      <form onSubmit={onAdd} className="card p-4 grid grid-cols-1 lg:grid-cols-[1.2fr_1.4fr_220px_auto] gap-3 items-end">
        <label className="block">
          <span className="label">שם הקבוצה</span>
          <input
            className="input"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="לדוגמה: דרושים בצפון"
          />
        </label>
        <label className="block">
          <span className="label">קישור לקבוצה</span>
          <input
            dir="ltr"
            className="input text-left"
            value={form.url}
            onChange={(e) => update('url', e.target.value)}
            placeholder="https://www.facebook.com/groups/..."
          />
        </label>
        <label className="block">
          <span className="label">אזור</span>
          <select className="input" value={form.region} onChange={(e) => update('region', e.target.value)}>
            {REGION_OPTIONS.map((region) => (
              <option key={region.value} value={region.value}>{region.label}</option>
            ))}
          </select>
        </label>
        <button className="btn-primary" type="submit" disabled={busy || !form.name.trim() || !form.url.trim()}>
          {busy ? 'מוסיף...' : 'הוסף'}
        </button>
        {message && <div className="lg:col-span-4 text-sm font-semibold text-brand-700">{message}</div>}
      </form>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {REGION_OPTIONS.filter((region) => region.value !== 'auto').map((region) => (
          <section key={region.value} className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3">
              <h2 className="font-bold">{region.label}</h2>
              <span className="badge bg-slate-100 text-slate-700 border border-slate-200">
                {grouped[region.value].length} קבוצות
              </span>
            </div>
            {grouped[region.value].length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">אין קבוצות באזור הזה.</div>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-[520px] overflow-auto">
                {grouped[region.value].map((group) => (
                  <li key={`${group.source}-${group.id}`} className="px-4 py-3 hover:bg-slate-50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{group.name}</div>
                        <a
                          className="mt-1 block text-xs text-brand-700 hover:underline truncate"
                          href={group.url}
                          target="_blank"
                          rel="noreferrer"
                          dir="ltr"
                        >
                          {group.url}
                        </a>
                      </div>
                      <span className={`badge shrink-0 ${group.source === 'database' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                        {group.source === 'database' ? 'נוסף במערכת' : 'קיים'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

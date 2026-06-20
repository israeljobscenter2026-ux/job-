import { useMemo, useState } from 'react';
import { useData } from '../contexts/DataContext.jsx';

const REGION_OPTIONS = [
  { value: 'all', label: 'כל האזורים' },
  { value: 'north', label: 'צפון' },
  { value: 'center', label: 'מרכז' },
  { value: 'sharon', label: 'השרון' },
  { value: 'jerusalem', label: 'ירושלים והסביבה' },
  { value: 'south', label: 'דרום' }
];

const LAP_OPTIONS = [
  { value: 'all', label: 'כל ה-LAP' },
  { value: 'lap1', label: 'Lap 1' },
  { value: 'lap2', label: 'Lap 2' },
  { value: 'lap3', label: 'Lap 3' },
  { value: 'lap4', label: 'Lap 4' }
];

const REGION_LABELS = {
  north: 'צפון',
  center: 'מרכז',
  sharon: 'השרון',
  jerusalem: 'ירושלים והסביבה',
  south: 'דרום',
  allcountry: 'כל הארץ'
};

export default function PublishAdPage() {
  const { ads } = useData();
  const [adId, setAdId] = useState('');
  const [region, setRegion] = useState('all');
  const [lap, setLap] = useState('all');
  const [dev, setDev] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishResult, setPublishResult] = useState(null);

  const sortedAds = useMemo(
    () => [...ads].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [ads]
  );

  const selectedAd = sortedAds.find((ad) => ad.id === adId);

  async function loadPreview(ev) {
    ev.preventDefault();
    if (!adId) return;

    setBusy(true);
    setError('');
    setPreview(null);
    setPublishError('');
    setPublishResult(null);

    try {
      const response = await fetch('http://127.0.0.1:4546/publish-facebook-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId, region, lap, dev })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'לא הצלחנו לבדוק קבוצות לפרסום.');
      }

      setPreview(payload);
    } catch (err) {
      const isConnectionError = err instanceof TypeError;
      setError(isConnectionError
        ? 'כדי להפעיל פרסום יש להריץ קודם: npm run publish:server'
        : err.message || 'לא הצלחנו לבדוק קבוצות לפרסום.');
    } finally {
      setBusy(false);
    }
  }

  async function startPublish() {
    if (!adId || !preview) return;

    setPublishBusy(true);
    setPublishError('');
    setPublishResult(null);

    try {
      const response = await fetch('http://127.0.0.1:4546/start-facebook-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId, region, lap, dev })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'לא הצלחנו להתחיל את הפרסום.');
      }

      setPublishResult(payload);
    } catch (err) {
      const isConnectionError = err instanceof TypeError;
      setPublishError(isConnectionError
        ? 'כדי להפעיל פרסום יש להריץ קודם: npm run publish:server'
        : err.message || 'לא הצלחנו להתחיל את הפרסום.');
    } finally {
      setPublishBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">פרסום מודעה</h1>
        <p className="text-slate-500 text-sm">בחר מודעה, אזור ו-LAP כדי לראות אילו קבוצות ייכנסו להרצת הפרסום.</p>
      </header>

      <section className="card p-4">
        <form onSubmit={loadPreview} className="grid grid-cols-1 lg:grid-cols-[1.5fr_220px_180px_auto] gap-3 items-end">
          <label className="block">
            <span className="label">מודעה</span>
            <select className="input" value={adId} onChange={(e) => setAdId(e.target.value)}>
              <option value="">בחר מודעה</option>
              {sortedAds.map((ad) => (
                <option key={ad.id} value={ad.id}>
                  {ad.title || 'פרסומת'} {ad.status === 'published' ? '(פורסם)' : '(טיוטה)'}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">אזור</span>
            <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
              {REGION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="label">LAP</span>
            <select className="input" value={lap} onChange={(e) => setLap(e.target.value)}>
              {LAP_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <button className="btn-primary" type="submit" disabled={busy || !adId}>
            {busy ? 'בודק...' : 'בדוק קבוצות לפרסום'}
          </button>

          <label className="lg:col-span-4 inline-flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={dev}
              onChange={(e) => setDev(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            מצב בדיקה
          </label>
        </form>

        {selectedAd && (
          <div className="mt-4 rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-600">
            מודעה נבחרת: <span className="font-semibold text-slate-900">{selectedAd.title || 'פרסומת'}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            {error}
          </div>
        )}

        {publishError && (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            {publishError}
          </div>
        )}

        {publishBusy && (
          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
            הפרסום רץ. אשר ידנית כל פוסט בחלון פייסבוק.
          </div>
        )}

        {publishResult && (
          <div className="mt-4 grid gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            <div className="font-bold">{publishResult.message || 'הפרסום הסתיים.'}</div>
            <div>הוכנו {publishResult.prepared || 0} פוסטים</div>
            <div>דולגו {publishResult.skipped || 0} קבוצות</div>
            <div>נכשלו {publishResult.failed || 0} קבוצות</div>
          </div>
        )}
      </section>

      {preview && (
        <section className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-bold">קבוצות שנבחרו</h2>
              <p className="text-sm text-slate-500">{preview.adTitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge bg-brand-100 text-brand-700 border border-brand-200">
                {preview.totalGroups} קבוצות
              </span>
              {preview.groups.length > 0 && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={startPublish}
                  disabled={publishBusy}
                >
                  {publishBusy ? 'מריץ פרסום...' : 'התחל פרסום'}
                </button>
              )}
            </div>
          </div>

          {preview.groups.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">לא נמצאו קבוצות שתואמות לבחירה.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-right font-semibold">שם קבוצה</th>
                    <th className="px-4 py-3 text-right font-semibold">קישור</th>
                    <th className="px-4 py-3 text-right font-semibold">אזור</th>
                    <th className="px-4 py-3 text-right font-semibold">שפה</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {preview.groups.map((group) => (
                    <tr key={group.url} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold text-slate-900">{group.name}</td>
                      <td className="px-4 py-3">
                        <a className="text-brand-700 hover:underline" href={group.url} target="_blank" rel="noreferrer" dir="ltr">
                          {group.url}
                        </a>
                      </td>
                      <td className="px-4 py-3">{REGION_LABELS[group.region] || group.region || '-'}</td>
                      <td className="px-4 py-3">{group.language || 'he'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

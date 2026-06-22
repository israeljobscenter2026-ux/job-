import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../contexts/DataContext.jsx';
import Modal from '../components/Modal.jsx';
import { fileToResizedDataUrl, approxDataUrlKB } from '../lib/image.js';

const STATUS_LABEL = { draft: 'טיוטה', published: 'פורסם' };
const STATUS_COLOR = {
  draft: 'bg-amber-100 text-amber-800 border border-amber-200',
  published: 'bg-emerald-100 text-emerald-800 border border-emerald-200'
};
const TARGET_REGION_OPTIONS = [
  { value: 'allcountry', label: 'כל הארץ' },
  { value: 'north', label: 'צפון' },
  { value: 'center', label: 'מרכז' },
  { value: 'sharon', label: 'השרון' },
  { value: 'jerusalem', label: 'ירושלים והסביבה' },
  { value: 'south', label: 'דרום' },
  { value: 'all', label: 'כל הקבוצות' }
];
const TARGET_REGION_LABELS = Object.fromEntries(TARGET_REGION_OPTIONS.map((option) => [option.value, option.label]));

export default function AdsPage() {
  const { ads, publisherGroups, createAd, updateAd, publishAd, unpublishAd, deleteAd } = useData();
  const [filter, setFilter] = useState('all');
  const [copiedCommand, setCopiedCommand] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [publishTarget, setPublishTarget] = useState(null);
  const [facebookPublishBusyId, setFacebookPublishBusyId] = useState(null);
  const [facebookPublishMessage, setFacebookPublishMessage] = useState('');
  const [facebookPublishResult, setFacebookPublishResult] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteStep, setDeleteStep] = useState(0);

  const filtered = useMemo(() => {
    const list = [...ads].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (filter === 'all') return list;
    return list.filter((a) => a.status === filter);
  }, [ads, filter]);

  const counts = useMemo(() => ({
    all: ads.length,
    draft: ads.filter((a) => a.status === 'draft').length,
    published: ads.filter((a) => a.status === 'published').length
  }), [ads]);
  const publisherCommands = useMemo(() => buildPublisherCommands(publisherGroups), [publisherGroups]);

  function openCreate() {
    setEditingId(null);
    setEditorOpen(true);
  }
  function openEdit(ad) {
    setEditingId(ad.id);
    setEditorOpen(true);
  }
  function closeEditor() {
    setEditorOpen(false);
    setEditingId(null);
  }
  function confirmDelete(ad) {
    setDeleteTarget(ad);
    setDeleteStep(1);
  }
  function performDelete() {
    if (deleteTarget) deleteAd(deleteTarget.id);
    setDeleteTarget(null);
    setDeleteStep(0);
  }
  async function copyCommand(command) {
    await copyText(command);
    setCopiedCommand(command);
    window.setTimeout(() => setCopiedCommand(''), 1600);
  }
  async function startFacebookPublish(ad) {
    setFacebookPublishBusyId(ad.id);
    setFacebookPublishMessage('הפרסום רץ. אשר ידנית כל פוסט בחלון פייסבוק.');
    setFacebookPublishResult(null);

    try {
      const response = await fetch('http://127.0.0.1:4546/start-facebook-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adId: ad.id, dev: true })
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'לא הצלחנו להתחיל פרסום בפייסבוק.');
      }

      setFacebookPublishResult({
        adTitle: ad.title || 'פרסומת',
        targetRegion: payload.targetRegion || ad.targetRegion || 'allcountry',
        totalGroups: payload.totalGroups || 0,
        prepared: payload.prepared || 0,
        skipped: payload.skipped || 0,
        failed: payload.failed || 0
      });
      setFacebookPublishMessage('');
    } catch (err) {
      const isConnectionError = err instanceof TypeError;
      setFacebookPublishMessage(isConnectionError
        ? 'כדי לפרסם בפייסבוק יש להפעיל קודם: npm run publish:server'
        : err.message || 'לא הצלחנו להתחיל פרסום בפייסבוק.');
    } finally {
      setFacebookPublishBusyId(null);
    }
  }

  const editingAd = editingId ? ads.find((a) => a.id === editingId) : null;

  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">ניהול פרסומות</h1>
          <p className="text-slate-500 text-sm">צור מודעות, פרסם אותן וסמן תאריך פרסום. ההערות נשמרות פנימית.</p>
        </div>
        <button className="btn-primary" onClick={openCreate}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
          פרסומת חדשה
        </button>
      </header>

      <PublisherCommandsPanel
        commands={publisherCommands}
        copiedCommand={copiedCommand}
        onCopy={copyCommand}
      />

      {(facebookPublishMessage || facebookPublishResult) && (
        <section className={`card p-4 ${facebookPublishResult ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          {facebookPublishMessage && (
            <p className="text-sm font-semibold text-amber-900">{facebookPublishMessage}</p>
          )}
          {facebookPublishResult && (
            <div className="grid gap-1 text-sm text-emerald-900">
              <div className="font-bold">תוצאת פרסום בפייסבוק: {facebookPublishResult.adTitle}</div>
              <div>אזור יעד: {TARGET_REGION_LABELS[facebookPublishResult.targetRegion] || facebookPublishResult.targetRegion}</div>
              <div>נבחרו {facebookPublishResult.totalGroups} קבוצות</div>
              <div>הוכנו {facebookPublishResult.prepared} פוסטים</div>
              <div>דולגו {facebookPublishResult.skipped} קבוצות</div>
              <div>נכשלו {facebookPublishResult.failed} קבוצות</div>
            </div>
          )}
        </section>
      )}

      <div className="flex gap-2 flex-wrap">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label={`הכול (${counts.all})`} />
        <FilterChip active={filter === 'draft'} onClick={() => setFilter('draft')} label={`טיוטה (${counts.draft})`} />
        <FilterChip active={filter === 'published'} onClick={() => setFilter('published')} label={`פורסם (${counts.published})`} />
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">
          {ads.length === 0 ? 'עדיין לא נוצרו פרסומות. הוסיפו את הראשונה.' : 'אין פרסומות בקטגוריה זו.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((ad) => (
            <AdCard
              key={ad.id}
              ad={ad}
              onEdit={() => openEdit(ad)}
              onPublish={() => setPublishTarget(ad)}
              onFacebookPublish={() => startFacebookPublish(ad)}
              facebookPublishBusy={facebookPublishBusyId === ad.id}
              onUnpublish={() => unpublishAd(ad.id)}
              onDelete={() => confirmDelete(ad)}
            />
          ))}
        </div>
      )}

      <AdEditor
        open={editorOpen}
        ad={editingAd}
        onClose={closeEditor}
        onCreate={(payload) => { createAd(payload); closeEditor(); }}
        onUpdate={(payload) => { updateAd(editingId, payload); closeEditor(); }}
      />

      <PublishDialog
        ad={publishTarget}
        onClose={() => setPublishTarget(null)}
        onConfirm={(dateIso) => {
          publishAd(publishTarget.id, dateIso);
          setPublishTarget(null);
        }}
      />

      <Modal
        open={deleteStep > 0}
        title="מחיקת פרסומת"
        onClose={() => { setDeleteTarget(null); setDeleteStep(0); }}
        footer={
          deleteStep === 1 ? (
            <>
              <button className="btn-secondary" onClick={() => { setDeleteTarget(null); setDeleteStep(0); }}>ביטול</button>
              <button className="btn-danger" onClick={() => setDeleteStep(2)}>המשך למחיקה</button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => { setDeleteTarget(null); setDeleteStep(0); }}>ביטול</button>
              <button className="btn-danger" onClick={performDelete}>אישור סופי – מחק</button>
            </>
          )
        }
      >
        {deleteTarget && deleteStep === 1 && (
          <p className="text-sm">למחוק את הפרסומת <strong>{deleteTarget.title || 'ללא כותרת'}</strong>?</p>
        )}
        {deleteStep === 2 && (
          <p className="text-sm">אישור שני: המחיקה היא סופית ולא ניתן לשחזר.</p>
        )}
      </Modal>
    </div>
  );
}

function FilterChip({ active, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={`badge px-3 py-1.5 text-sm ${
        active
          ? 'bg-brand-600 text-white border border-brand-700'
          : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );
}

function PublisherCommandsPanel({ commands, copiedCommand, onCopy }) {
  return (
    <section className="card p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">פקודות פרסום</h2>
          <p className="text-xs text-slate-500">בחר סבב, העתק פקודה והרץ אותה במחשב שמפעיל את הבוט.</p>
        </div>
        <span className="badge bg-slate-100 text-slate-700 border border-slate-200">
          {commands.reduce((sum, item) => sum + (item.primary ? item.count : 0), 0)} קבוצות בסבבים הראשיים
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {commands.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onCopy(item.command)}
            className="group rounded-lg border border-slate-200 bg-white p-3 text-right hover:border-brand-300 hover:bg-brand-50/40 transition shadow-sm"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-bold text-slate-900">{item.label}</div>
                <div className="text-xs text-slate-500">{item.count} קבוצות</div>
              </div>
              <span className={`badge shrink-0 ${copiedCommand === item.command ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-brand-100 text-brand-700 border border-brand-200'}`}>
                {copiedCommand === item.command ? 'הועתק' : 'העתק'}
              </span>
            </div>
            <code dir="ltr" className="mt-3 block rounded-md bg-slate-950 px-3 py-2 text-left text-xs font-semibold text-white overflow-x-auto">
              {item.command}
            </code>
          </button>
        ))}
      </div>
    </section>
  );
}

function AdCard({ ad, onEdit, onPublish, onFacebookPublish, facebookPublishBusy, onUnpublish, onDelete }) {
  const fmt = (iso) => new Date(iso).toLocaleDateString('he-IL');
  return (
    <div className="card overflow-hidden flex flex-col">
      <div className="relative aspect-video bg-slate-100">
        {ad.image ? (
          <img src={ad.image} alt={ad.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 grid place-items-center text-slate-400 text-sm">
            ללא תמונה
          </div>
        )}
        <span className={`badge absolute top-3 right-3 ${STATUS_COLOR[ad.status]}`}>
          {STATUS_LABEL[ad.status]}
        </span>
      </div>
      <div className="p-4 flex-1 flex flex-col">
        {ad.body && (
          <p className="text-sm text-slate-600 line-clamp-4 whitespace-pre-wrap">{ad.body}</p>
        )}
        <div className="mt-3 text-xs text-slate-500 space-y-1">
          <div>נוצר: {fmt(ad.createdAt)}</div>
          {ad.publishedAt && <div>פורסם: {fmt(ad.publishedAt)}</div>}
          <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-center text-sm font-bold text-slate-800">
            אזור יעד: {TARGET_REGION_LABELS[ad.targetRegion || 'allcountry'] || ad.targetRegion || 'כל הארץ'}
          </div>
          {ad.notes && (
            <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-center text-sm font-bold text-amber-900 line-clamp-3">
              <span>הערה: </span>{ad.notes}
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={onEdit}>עריכה</button>
          {ad.status === 'draft' ? (
            <button className="btn-primary !py-1.5 !px-3 text-xs" onClick={onPublish}>פרסם</button>
          ) : (
            <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={onUnpublish}>החזר לטיוטה</button>
          )}
          <button
            className="btn-primary !py-1.5 !px-3 text-xs"
            onClick={onFacebookPublish}
            disabled={facebookPublishBusy}
          >
            {facebookPublishBusy ? 'מפרסם...' : 'פרסם בפייסבוק'}
          </button>
          <button className="btn-ghost !py-1.5 !px-3 text-xs text-rose-600 hover:bg-rose-50" onClick={onDelete}>מחק</button>
        </div>
      </div>
    </div>
  );
}

function AdEditor({ open, ad, onClose, onCreate, onUpdate }) {
  const isEdit = !!ad;
  const fileRef = useRef(null);
  const [form, setForm] = useState({ title: '', body: '', image: '', notes: '', targetRegion: 'allcountry' });
  const [imgError, setImgError] = useState(null);
  const [imgBusy, setImgBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      title: ad?.title || '',
      body: ad?.body || '',
      image: ad?.image || '',
      notes: ad?.notes || '',
      targetRegion: ad?.targetRegion || 'allcountry'
    });
    setImgError(null);
  }, [open, ad?.id]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onPickFile(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = '';
    if (!file) return;
    setImgError(null);
    setImgBusy(true);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      update('image', dataUrl);
    } catch (e) {
      setImgError('לא הצלחנו לקרוא את התמונה. נסו קובץ JPG/PNG.');
    } finally {
      setImgBusy(false);
    }
  }

  function submit(ev) {
    ev?.preventDefault?.();
    const payload = {
      ...form,
      title: form.title || 'פרסומת'
    };
    if (isEdit) onUpdate(payload);
    else onCreate(payload);
  }

  const sizeKB = approxDataUrlKB(form.image);

  return (
    <Modal
      open={open}
      title={isEdit ? 'עריכת פרסומת' : 'פרסומת חדשה'}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
          <button className="btn-primary" onClick={submit}>{isEdit ? 'שמירה' : 'יצירה'}</button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <span className="label">תמונה</span>
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
            {form.image ? (
              <div className="space-y-3">
                <div className="relative w-full aspect-video bg-white rounded-lg overflow-hidden border border-slate-200">
                  <img src={form.image} alt="" className="absolute inset-0 w-full h-full object-contain" />
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>גודל מוערך: {sizeKB} KB</span>
                  <button type="button" className="btn-secondary !py-1 !px-2 text-xs" onClick={() => fileRef.current?.click()}>החלפת תמונה</button>
                  <button type="button" className="btn-ghost !py-1 !px-2 text-xs text-rose-600" onClick={() => update('image', '')}>הסרת תמונה</button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="w-full grid place-items-center py-8 text-slate-500 hover:bg-white rounded-lg transition"
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>
                <span className="mt-2 text-sm">לחצו לבחירת תמונה (JPG / PNG)</span>
                <span className="text-xs">התמונה תוקטן אוטומטית לעד 1280px</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} disabled={imgBusy} />
            {imgBusy && <div className="mt-2 text-xs text-slate-500">מעבד תמונה...</div>}
            {imgError && <div className="mt-2 text-xs text-rose-600">{imgError}</div>}
          </div>
        </div>

        <label className="block">
          <span className="label">אזור יעד</span>
          <select
            className="input"
            value={form.targetRegion}
            onChange={(e) => update('targetRegion', e.target.value)}
          >
            {TARGET_REGION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-slate-500">
            לפי אזור זה המערכת תבחר אוטומטית קבוצות לפרסום בפייסבוק.
          </span>
        </label>

        <label className="block">
          <span className="label">טקסט המודעה</span>
          <textarea
            className="input min-h-[140px]"
            value={form.body}
            onChange={(e) => update('body', e.target.value)}
            placeholder="גוף הטקסט שיופיע בפרסומת. קישור דף הנחיתה יתווסף אוטומטית מתחת לטקסט."
          />
          <span className="mt-1 block text-xs text-slate-500">
            הקישור לדף הנחיתה יתווסף אוטומטית מתחת לטקסט לאחר השמירה.
          </span>
        </label>

        <label className="block">
          <span className="label">הערות פנימיות</span>
          <textarea
            className="input min-h-[80px]"
            value={form.notes}
            onChange={(e) => update('notes', e.target.value)}
            placeholder="הערות שלא מוצגות בפרסומת — לשימוש פנימי"
          />
        </label>
      </form>
    </Modal>
  );
}

function PublishDialog({ ad, onClose, onConfirm }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  if (!ad) return null;
  return (
    <Modal
      open={!!ad}
      title="פרסום מודעה"
      onClose={onClose}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
          <button className="btn-primary" onClick={() => onConfirm(date)}>פרסם</button>
        </>
      }
    >
      <p className="text-sm mb-3">
        סימון הפרסומת <strong>{ad.title || 'ללא כותרת'}</strong> כפורסמה.
      </p>
      <label className="block">
        <span className="label">תאריך פרסום</span>
        <input
          className="input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
    </Modal>
  );
}

function buildPublisherCommands(groups) {
  const buckets = {
    allcountry: [],
    north: [],
    center: [],
    jerusalem: [],
    sharon: [],
    south: []
  };

  groups.forEach((group) => {
    if (isAllCountryGroup(group)) {
      buckets.allcountry.push(group);
      return;
    }
    buckets[detectGroupRegion(group)].push(group);
  });

  const lapCounts = getLapCounts(groups, 4);
  const command = (round) => `node publisher.js ${round} --dev`;
  const allCountryCommands = getChunks(buckets.allcountry, 25).map((chunk, index, chunks) => ({
    key: `all${index + 1}`,
    label: chunks.length === 1 ? 'כל הארץ' : `כל הארץ ${index + 1}`,
    count: chunk.length,
    command: command(`all${index + 1}`),
    primary: true
  }));

  return [
    ...allCountryCommands,
    { key: 'north', label: 'צפון', count: buckets.north.length, command: command('north'), primary: true },
    { key: 'center', label: 'מרכז', count: buckets.center.length, command: command('center'), primary: true },
    { key: 'jerusalem', label: 'ירושלים והסביבה', count: buckets.jerusalem.length, command: command('jerusalem'), primary: true },
    { key: 'sharon', label: 'השרון', count: buckets.sharon.length, command: command('sharon'), primary: true },
    { key: 'south', label: 'דרום', count: buckets.south.length, command: command('south'), primary: true },
    { key: 'lap1', label: 'Lap 1', count: lapCounts[0], command: command('lap1') },
    { key: 'lap2', label: 'Lap 2', count: lapCounts[1], command: command('lap2') },
    { key: 'lap3', label: 'Lap 3', count: lapCounts[2], command: command('lap3') },
    { key: 'lap4', label: 'Lap 4', count: lapCounts[3], command: command('lap4') }
  ];
}

function getLapCounts(groups, lapCount) {
  const baseSize = Math.floor(groups.length / lapCount);
  const remainder = groups.length % lapCount;
  return Array.from({ length: lapCount }, (_, index) => baseSize + (index < remainder ? 1 : 0));
}

function getChunks(items, chunkSize) {
  if (items.length === 0) return [[]];
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

function isAllCountryGroup(group) {
  if (group?.region === 'allcountry') return true;
  const name = normalizeHebrewText(group?.name || '');
  const explicitAllCountry = hasAny(name, ['בכל הארץ', 'כל הארץ', 'כל רחבי הארץ', 'כלל ארצי']);
  const multiRegion = hasAny(name, ['מרכז']) && hasAny(name, ['צפון', 'דרום', 'ירושלים']);
  return explicitAllCountry || multiRegion;
}

function detectGroupRegion(group) {
  if (['north', 'center', 'jerusalem', 'sharon', 'south'].includes(group?.region)) return group.region;
  const name = normalizeHebrewText(group?.name || '');

  if (hasAny(name, ['ירושלים'])) return 'jerusalem';
  if (hasAny(name, ['עמק חפר', 'השרון', 'שרון', 'חדרה', 'נתניה', 'רעננה', 'הרצליה'])) return 'sharon';
  if (hasAny(name, ['חיפה', 'קריות', 'הקריות', 'נשר', 'עכו', 'צפון']) && !hasAny(name, ['תל אביב', 'ת א', 'תא'])) {
    return 'north';
  }
  if (hasAny(name, ['שדרות', 'אשדוד', 'קריית גת', 'באר שבע', 'נתיבות', 'דימונה', 'רהט', 'גדרה', 'יבנה', 'רחובות', 'דרום'])) {
    return 'south';
  }
  if (hasAny(name, ['מרכז', 'תל אביב', 'ת א', 'תא', 'פתח תקווה', 'פ ת', 'פתח תקוה', 'חולון', 'בת ים', 'ראשון לציון', 'רמלה', 'לוד', 'גוש דן', 'ראש העין', 'רמת גן', 'גבעתיים'])) {
    return 'center';
  }
  return 'allcountry';
}

function normalizeHebrewText(value) {
  return String(value)
    .replace(/[״"]/g, '')
    .replace(/[׳']/g, '')
    .replace(/[-_/\\|,().:;!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasAny(value, needles) {
  return needles.some((needle) => value.includes(needle));
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const el = document.createElement('textarea');
  el.value = text;
  el.setAttribute('readonly', '');
  el.style.position = 'fixed';
  el.style.opacity = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

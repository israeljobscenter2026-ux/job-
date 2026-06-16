import { useEffect, useMemo, useRef, useState } from 'react';
import { useData } from '../contexts/DataContext.jsx';
import Modal from '../components/Modal.jsx';
import { fileToResizedDataUrl, approxDataUrlKB } from '../lib/image.js';

const STATUS_LABEL = { draft: 'טיוטה', published: 'פורסם' };
const STATUS_COLOR = {
  draft: 'bg-amber-100 text-amber-800 border border-amber-200',
  published: 'bg-emerald-100 text-emerald-800 border border-emerald-200'
};

export default function AdsPage() {
  const { ads, createAd, updateAd, publishAd, unpublishAd, deleteAd } = useData();
  const [filter, setFilter] = useState('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [publishTarget, setPublishTarget] = useState(null);
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

function AdCard({ ad, onEdit, onPublish, onUnpublish, onDelete }) {
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
        <div className="font-semibold text-slate-900 truncate">{ad.title || 'ללא כותרת'}</div>
        {ad.body && (
          <p className="mt-1 text-sm text-slate-600 line-clamp-3 whitespace-pre-wrap">{ad.body}</p>
        )}
        <div className="mt-3 text-xs text-slate-500 space-y-1">
          <div>נוצר: {fmt(ad.createdAt)}</div>
          {ad.publishedAt && <div>פורסם: {fmt(ad.publishedAt)}</div>}
          {ad.notes && (
            <div className="mt-2 rounded-md bg-amber-50 border border-amber-100 px-2 py-1.5 text-amber-900 line-clamp-2">
              <span className="font-medium">הערה: </span>{ad.notes}
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
          <button className="btn-ghost !py-1.5 !px-3 text-xs text-rose-600 hover:bg-rose-50" onClick={onDelete}>מחק</button>
        </div>
      </div>
    </div>
  );
}

function AdEditor({ open, ad, onClose, onCreate, onUpdate }) {
  const isEdit = !!ad;
  const fileRef = useRef(null);
  const [form, setForm] = useState({ title: '', body: '', image: '', notes: '' });
  const [imgError, setImgError] = useState(null);
  const [imgBusy, setImgBusy] = useState(false);
  const [titleError, setTitleError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setForm({
      title: ad?.title || '',
      body: ad?.body || '',
      image: ad?.image || '',
      notes: ad?.notes || ''
    });
    setImgError(null);
    setTitleError(null);
  }, [open, ad?.id]);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === 'title' && titleError) setTitleError(null);
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
    if (!form.title.trim()) {
      setTitleError('יש להזין כותרת לפרסומת');
      return;
    }
    if (isEdit) onUpdate(form);
    else onCreate(form);
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
          <span className="label">כותרת <span className="text-rose-600">*</span></span>
          <input
            className="input"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            maxLength={200}
            placeholder="לדוגמה: דרושים נציגי שירות לקוחות באזור חיפה"
          />
          {titleError && <span className="mt-1 block text-xs text-rose-600">{titleError}</span>}
        </label>

        <label className="block">
          <span className="label">טקסט המודעה</span>
          <textarea
            className="input min-h-[140px]"
            value={form.body}
            onChange={(e) => update('body', e.target.value)}
            placeholder="גוף הטקסט שיופיע בפרסומת"
          />
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


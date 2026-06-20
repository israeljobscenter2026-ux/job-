import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../contexts/DataContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import {
  STATUSES,
  STATUS_LABELS,
  STATUS_ORDER,
  JOB_TYPE_LABELS
} from '../lib/statuses.js';
import StatusBadge from '../components/StatusBadge.jsx';
import Modal from '../components/Modal.jsx';
import {
  isValidIsraeliMobile,
  isValidIsraeliId,
  isNonEmpty,
  normalizePhone,
  normalizeId
} from '../lib/validation.js';
import { buildWhatsappUrl, fillTemplate, TEMPLATE_KEYS } from '../lib/whatsapp.js';
import { getAreas, getCities, getProjects, getRoles, getLeadJobTitle } from '../lib/jobCatalog.js';

const TWO_MONTHS_MS = 1000 * 60 * 60 * 24 * 60;

export default function LeadDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { leads, templates, updateLead, deleteLead } = useData();
  const { user } = useAuth();
  const lead = useMemo(() => leads.find((l) => l.id === id), [leads, id]);

  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(0); // 0 = closed, 1 = first, 2 = second
  const [statusDraft, setStatusDraft] = useState(null);
  const [hireDateInput, setHireDateInput] = useState('');
  const [notesDraft, setNotesDraft] = useState('');

  useEffect(() => {
    if (lead) {
      setStatusDraft(lead.status);
      setHireDateInput(lead.hireDate ? lead.hireDate.slice(0, 10) : '');
      setNotesDraft(lead.notes || '');
    }
  }, [lead?.id]);

  if (!lead) {
    return (
      <div className="card p-8 text-center">
        <p className="text-slate-600 mb-4">פונה לא נמצא.</p>
        <Link to="/admin/leads" className="btn-secondary">חזרה לרשימה</Link>
      </div>
    );
  }

  const needsReminder = lead.status === STATUSES.HIRED && lead.hireDate &&
    Date.now() - new Date(lead.hireDate).getTime() >= TWO_MONTHS_MS;
  const hireDateRequired = statusDraft === STATUSES.HIRED;
  const actor = user?.name || user?.email || 'מנהל';

  function saveStatus() {
    if (hireDateRequired && !hireDateInput) {
      alert('יש להזין תאריך קליטה כשהסטטוס "התקבל לעבודה"');
      return;
    }
    const patch = { status: statusDraft };
    if (statusDraft === STATUSES.HIRED) patch.hireDate = new Date(hireDateInput).toISOString();
    updateLead(lead.id, patch, actor);
  }

  function saveNotes() {
    updateLead(lead.id, { notes: notesDraft }, actor);
  }

  function doDelete() {
    deleteLead(lead.id);
    navigate('/admin/leads');
  }

  const initials = `${(lead.firstName || '?').slice(0, 1)}${(lead.lastName || '').slice(0, 1)}`.toUpperCase();

  return (
    <div className="space-y-5 animate-fade-up">
      <Link to="/admin/leads" className="text-sm text-slate-500 hover:text-brand-700 inline-flex items-center gap-1">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>
        חזרה לרשימת הפונים
      </Link>

      <header className="card p-5 md:p-6 flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div className="h-14 w-14 rounded-2xl bg-grad-brand text-white grid place-items-center font-bold text-lg shadow-glow shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {lead.firstName} {lead.lastName}
            </h1>
            <div className="flex items-center gap-2 mt-2 text-sm flex-wrap">
              <StatusBadge status={lead.status} />
              {needsReminder && (
                <span className="badge bg-rose-100 text-rose-700 border border-rose-200">דרושה בדיקה</span>
              )}
              <span className="text-slate-500">· נכנס {fmtDateTime(lead.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button className="btn-secondary flex-1 sm:flex-none" onClick={() => setEditOpen(true)}>עריכת פרטים</button>
          <button className="btn-danger flex-1 sm:flex-none" onClick={() => setConfirmDelete(1)}>מחיקת פונה</button>
        </div>
      </header>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Personal details */}
        <section className="card p-5 lg:col-span-1">
          <h2 className="text-lg font-semibold mb-3">פרטים אישיים</h2>
          <dl className="text-sm space-y-2">
            <Row label="שם פרטי" value={lead.firstName} />
            <Row label="שם משפחה" value={lead.lastName} />
            <Row label="טלפון נייד" value={<a href={`tel:${lead.phone}`} className="font-mono ltr-cell text-brand-700 hover:underline">{lead.phone}</a>} />
            <Row label="תעודת זהות" value={<span className="font-mono ltr-cell">{lead.idNumber}</span>} />
            <Row label="אזור / אתר" value={lead.area} />
            <Row label="עיר" value={lead.city} />
            <Row label="פרויקט / מוקד" value={lead.project} />
            <Row label="משרה" value={getLeadJobTitle(lead) || JOB_TYPE_LABELS[lead.jobType] || '-'} />
            <Row label="תאריך עדכון" value={fmtDateTime(lead.updatedAt)} />
            {lead.hireDate && <Row label="תאריך קליטה" value={fmtDate(lead.hireDate)} />}
          </dl>
        </section>

        {/* Status + notes */}
        <section className="card p-5 lg:col-span-2 space-y-5">
          <div>
            <h2 className="text-lg font-semibold mb-3">ניהול סטטוס</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="label">סטטוס</span>
                <select
                  className="input"
                  value={statusDraft || ''}
                  onChange={(e) => setStatusDraft(e.target.value)}
                >
                  {STATUS_ORDER.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </label>
              {hireDateRequired && (
                <label className="block">
                  <span className="label">תאריך קליטה <span className="text-rose-600">*</span></span>
                  <input
                    className="input"
                    type="date"
                    value={hireDateInput}
                    onChange={(e) => setHireDateInput(e.target.value)}
                  />
                </label>
              )}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                className="btn-primary"
                onClick={saveStatus}
                disabled={statusDraft === lead.status &&
                  (statusDraft !== STATUSES.HIRED || (lead.hireDate || '').slice(0, 10) === hireDateInput)}
              >
                שמירת סטטוס
              </button>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">הערות פנימיות</h2>
            <textarea
              className="input min-h-[100px]"
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              placeholder="כתוב/י כאן הערות פנימיות הקשורות לפונה זה..."
            />
            <div className="mt-2 flex justify-end">
              <button className="btn-secondary" onClick={saveNotes} disabled={notesDraft === (lead.notes || '')}>שמירת הערות</button>
            </div>
          </div>

          <WhatsappButtons lead={lead} templates={templates} />
        </section>
      </div>

      <section className="card p-5">
        <h2 className="text-lg font-semibold mb-3">היסטוריית סטטוסים</h2>
        {(!lead.statusHistory || lead.statusHistory.length === 0) ? (
          <p className="text-sm text-slate-500">אין שינויי סטטוס.</p>
        ) : (
          <ol className="relative border-r border-slate-200 pr-4 space-y-3">
            {[...lead.statusHistory].reverse().map((h, idx) => (
              <li key={idx} className="relative">
                <span className="absolute right-[-9px] top-1.5 h-3 w-3 rounded-full bg-brand-600 border-2 border-white shadow" />
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={h.status} />
                  <span className="text-xs text-slate-500">{fmtDateTime(h.at)}</span>
                  <span className="text-xs text-slate-400">· {h.by}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <EditLeadModal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        lead={lead}
        onSave={(patch) => {
          updateLead(lead.id, patch, actor);
          setEditOpen(false);
        }}
      />

      <Modal
        open={confirmDelete > 0}
        title="מחיקת פונה"
        onClose={() => setConfirmDelete(0)}
        footer={
          confirmDelete === 1 ? (
            <>
              <button className="btn-secondary" onClick={() => setConfirmDelete(0)}>ביטול</button>
              <button className="btn-danger" onClick={() => setConfirmDelete(2)}>המשך למחיקה</button>
            </>
          ) : (
            <>
              <button className="btn-secondary" onClick={() => setConfirmDelete(0)}>ביטול</button>
              <button className="btn-danger" onClick={doDelete}>אישור סופי – מחק</button>
            </>
          )
        }
      >
        {confirmDelete === 1 ? (
          <p className="text-sm">פעולה זו תמחק את הפונה <strong>{lead.firstName} {lead.lastName}</strong> מהמערכת. האם להמשיך?</p>
        ) : (
          <p className="text-sm">אישור שני: המחיקה היא סופית ולא ניתן לשחזר את הפונה. למחוק?</p>
        )}
      </Modal>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 last:border-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800 text-left">{value || '-'}</dd>
    </div>
  );
}

function WhatsappButtons({ lead, templates }) {
  const items = [
    { key: TEMPLATE_KEYS.INITIAL, color: 'bg-emerald-600 hover:bg-emerald-700' },
    { key: TEMPLATE_KEYS.SENT, color: 'bg-amber-500 hover:bg-amber-600' },
    { key: TEMPLATE_KEYS.HIRED, color: 'bg-brand-600 hover:bg-brand-700' },
    { key: TEMPLATE_KEYS.TWO_MONTHS_CHECK, color: 'bg-violet-600 hover:bg-violet-700' },
    { key: TEMPLATE_KEYS.IRRELEVANT, color: 'bg-slate-600 hover:bg-slate-700' }
  ];
  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">הודעות WhatsApp מוכנות</h2>
      <p className="text-xs text-slate-500 mb-3">
        לחיצה על אחד הכפתורים פותחת את WhatsApp עם הודעה מוכנה. השליחה נשארת ידנית – ההודעה לא נשלחת אוטומטית.
      </p>
      <div className="grid sm:grid-cols-2 gap-2">
        {items.map(({ key, color }) => {
          const t = templates?.[key];
          if (!t) return null;
          const message = fillTemplate(t.body, lead);
          const href = buildWhatsappUrl(lead.phone, message);
          return (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`btn text-white ${color}`}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.52 3.48A11.78 11.78 0 0012.05 0C5.5 0 .19 5.31.19 11.86c0 2.09.55 4.13 1.6 5.93L0 24l6.4-1.68a11.84 11.84 0 005.65 1.44h.01c6.55 0 11.86-5.31 11.86-11.86 0-3.17-1.23-6.15-3.4-8.42zM12.05 21.5h-.01a9.6 9.6 0 01-4.9-1.34l-.35-.21-3.8 1 1.02-3.7-.23-.38a9.62 9.62 0 01-1.48-5.11c0-5.32 4.33-9.65 9.66-9.65 2.58 0 5 1 6.83 2.83a9.62 9.62 0 012.83 6.83c0 5.32-4.33 9.65-9.66 9.65zm5.3-7.22c-.29-.15-1.72-.85-1.98-.95-.27-.1-.46-.15-.66.15-.2.29-.76.95-.93 1.14-.17.2-.35.22-.64.07-.29-.15-1.23-.45-2.34-1.44-.86-.77-1.45-1.72-1.62-2.01-.17-.29-.02-.45.13-.6.13-.13.29-.35.43-.52.14-.17.2-.29.29-.49.1-.2.05-.36-.02-.51-.07-.15-.66-1.59-.91-2.18-.24-.57-.49-.49-.66-.5l-.56-.01a1.08 1.08 0 00-.78.36c-.27.29-1.03 1.01-1.03 2.46s1.06 2.85 1.21 3.05c.15.2 2.09 3.18 5.06 4.46.71.31 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.09 1.72-.7 1.96-1.38.24-.68.24-1.26.17-1.38-.07-.12-.27-.2-.56-.34z"/></svg>
              <span className="truncate">{t.title}</span>
            </a>
          );
        })}
      </div>
    </div>
  );
}

function EditLeadModal({ open, onClose, lead, onSave }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', idNumber: '', area: '', city: '', project: '', jobRole: '', jobType: ''
  });
  const [errors, setErrors] = useState({});
  const areaOptions = getAreas();
  const cityOptions = getCities(form.area);
  const projectOptions = getProjects(form.area, form.city);
  const roleOptions = getRoles(form.area, form.city, form.project);

  useEffect(() => {
    if (open && lead) {
      setForm({
        firstName: lead.firstName || '',
        lastName: lead.lastName || '',
        phone: lead.phone || '',
        idNumber: lead.idNumber || '',
        area: lead.area || '',
        city: lead.city || '',
        project: lead.project || '',
        jobRole: lead.jobRole || '',
        jobType: lead.jobType || ''
      });
      setErrors({});
    }
  }, [open, lead]);

  function update(k, v) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === 'area') return { ...next, city: '', project: '', jobRole: '', jobType: '' };
      if (k === 'city') return { ...next, project: '', jobRole: '', jobType: '' };
      if (k === 'project') return { ...next, jobRole: '', jobType: '' };
      if (k === 'jobRole') return { ...next, jobType: v };
      return next;
    });
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  }

  function submit(ev) {
    ev.preventDefault();
    const e = {};
    if (!isNonEmpty(form.firstName)) e.firstName = 'יש להזין שם פרטי';
    if (!isNonEmpty(form.lastName)) e.lastName = 'יש להזין שם משפחה';
    if (!isValidIsraeliMobile(form.phone)) e.phone = 'מספר נייד לא תקין';
    if (!isValidIsraeliId(form.idNumber)) e.idNumber = 'ת.ז לא תקינה';
    if (!isNonEmpty(form.area)) e.area = 'יש לבחור אזור';
    if (!isNonEmpty(form.city)) e.city = 'יש לבחור עיר';
    if (!isNonEmpty(form.project)) e.project = 'יש לבחור פרויקט';
    if (!isNonEmpty(form.jobRole)) e.jobRole = 'יש לבחור משרה';
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({
      ...form,
      phone: normalizePhone(form.phone),
      idNumber: normalizeId(form.idNumber)
    });
  }

  return (
    <Modal
      open={open}
      title="עריכת פרטי פונה"
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>ביטול</button>
          <button className="btn-primary" onClick={submit}>שמירה</button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FieldL label="שם פרטי" error={errors.firstName}>
          <input className="input" value={form.firstName} onChange={(e) => update('firstName', e.target.value)} />
        </FieldL>
        <FieldL label="שם משפחה" error={errors.lastName}>
          <input className="input" value={form.lastName} onChange={(e) => update('lastName', e.target.value)} />
        </FieldL>
        <FieldL label="טלפון" error={errors.phone}>
          <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        </FieldL>
        <FieldL label="ת.ז" error={errors.idNumber}>
          <input className="input" value={form.idNumber} onChange={(e) => update('idNumber', e.target.value)} />
        </FieldL>
        <FieldL label="אזור" error={errors.area}>
          <select className="input" value={form.area} onChange={(e) => update('area', e.target.value)}>
            <option value="">בחר/י</option>
            {areaOptions.map((area) => <option key={area} value={area}>{area}</option>)}
          </select>
        </FieldL>
        <FieldL label="עיר" error={errors.city}>
          <select className="input" value={form.city} onChange={(e) => update('city', e.target.value)} disabled={!form.area}>
            <option value="">בחר/י</option>
            {cityOptions.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
        </FieldL>
        <FieldL label="פרויקט / מוקד" error={errors.project}>
          <select className="input" value={form.project} onChange={(e) => update('project', e.target.value)} disabled={!form.city}>
            <option value="">בחר/י</option>
            {projectOptions.map((project) => <option key={project} value={project}>{project}</option>)}
          </select>
        </FieldL>
        <FieldL label="משרה" error={errors.jobRole}>
          <select className="input" value={form.jobRole} onChange={(e) => update('jobRole', e.target.value)} disabled={!form.project}>
            <option value="">בחר/י</option>
            {roleOptions.map((role) => <option key={role} value={role}>{role}</option>)}
          </select>
        </FieldL>
      </form>
    </Modal>
  );
}

function FieldL({ label, error, children }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {error && <span className="mt-1 block text-xs text-rose-600">{error}</span>}
    </label>
  );
}

function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('he-IL');
}
function fmtDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('he-IL');
}

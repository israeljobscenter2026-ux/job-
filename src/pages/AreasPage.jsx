import { useState } from 'react';
import { useData } from '../contexts/DataContext.jsx';
import Modal from '../components/Modal.jsx';

export default function AreasPage() {
  const { areas, addArea, updateArea, deleteArea, leads } = useData();
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  function onAdd(ev) {
    ev.preventDefault();
    if (!newName.trim()) return;
    addArea(newName);
    setNewName('');
  }

  function openEdit(a) {
    setEditing(a);
    setEditName(a.name);
  }

  function saveEdit() {
    if (!editName.trim() || !editing) return;
    updateArea(editing.id, editName);
    setEditing(null);
  }

  function leadsUsing(name) {
    return leads.filter((l) => l.area === name).length;
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">ניהול אזורים / אתרים</h1>
        <p className="text-slate-500 text-sm">הרשימה מופיעה כבחירה בדף הנחיתה הציבורי.</p>
      </header>

      <form onSubmit={onAdd} className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="label">שם אזור / אתר חדש</label>
          <input
            className="input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="לדוגמה: כפר סבא"
          />
        </div>
        <div className="self-end">
          <button className="btn-primary" type="submit" disabled={!newName.trim()}>הוספה</button>
        </div>
      </form>

      <div className="card overflow-hidden">
        {areas.length === 0 ? (
          <div className="p-8 text-center text-slate-500">עדיין לא הוגדרו אזורים.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {areas.map((a) => {
              const used = leadsUsing(a.name);
              return (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-slate-500">{used} פונים משויכים</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-secondary !py-1 !px-2 text-xs" onClick={() => openEdit(a)}>עריכה</button>
                    <button className="btn-danger !py-1 !px-2 text-xs" onClick={() => setConfirmDelete(a)}>מחיקה</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Modal
        open={!!editing}
        title="עריכת אזור"
        onClose={() => setEditing(null)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setEditing(null)}>ביטול</button>
            <button className="btn-primary" onClick={saveEdit}>שמירה</button>
          </>
        }
      >
        <label className="label">שם אזור</label>
        <input className="input" value={editName} onChange={(e) => setEditName(e.target.value)} />
      </Modal>

      <Modal
        open={!!confirmDelete}
        title="מחיקת אזור"
        onClose={() => setConfirmDelete(null)}
        footer={
          <>
            <button className="btn-secondary" onClick={() => setConfirmDelete(null)}>ביטול</button>
            <button className="btn-danger" onClick={() => { deleteArea(confirmDelete.id); setConfirmDelete(null); }}>מחק</button>
          </>
        }
      >
        {confirmDelete && (
          <p className="text-sm">
            למחוק את האזור <strong>{confirmDelete.name}</strong>?
            {leadsUsing(confirmDelete.name) > 0 && (
              <>
                <br />
                <span className="text-amber-700">שים/י לב: {leadsUsing(confirmDelete.name)} פונים משויכים לאזור זה. הם יישארו במערכת עם שם האזור הקיים, אך לא יוצג יותר ברשימת הבחירה.</span>
              </>
            )}
          </p>
        )}
      </Modal>
    </div>
  );
}

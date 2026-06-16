import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function AccountPage() {
  const { user, changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [pw1, setPw1] = useState('');
  const [pw2, setPw2] = useState('');
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(ev) {
    ev.preventDefault();
    setMsg(null);
    if (pw1 !== pw2) {
      setMsg({ type: 'error', text: 'הסיסמאות אינן תואמות' });
      return;
    }
    setBusy(true);
    const res = await changePassword(current, pw1);
    setBusy(false);
    if (!res.ok) {
      setMsg({ type: 'error', text: res.error });
      return;
    }
    setMsg({ type: 'success', text: 'הסיסמה עודכנה בהצלחה' });
    setCurrent(''); setPw1(''); setPw2('');
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <header>
        <h1 className="text-2xl font-bold">החשבון שלי</h1>
        <p className="text-slate-500 text-sm">פרטי המשתמש המחובר וסיסמה.</p>
      </header>

      <section className="card p-5">
        <h2 className="text-lg font-semibold mb-3">פרטי משתמש</h2>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <dt className="text-slate-500">שם</dt>
            <dd className="font-medium">{user?.name || '-'}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-100 pb-2">
            <dt className="text-slate-500">אימייל</dt>
            <dd className="font-medium">{user?.email}</dd>
          </div>
        </dl>
      </section>

      <section className="card p-5">
        <h2 className="text-lg font-semibold mb-3">החלפת סיסמה</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="label">סיסמה נוכחית</span>
            <input className="input" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </label>
          <label className="block">
            <span className="label">סיסמה חדשה (לפחות 6 תווים)</span>
            <input className="input" type="password" value={pw1} onChange={(e) => setPw1(e.target.value)} required minLength={6} />
          </label>
          <label className="block">
            <span className="label">אישור סיסמה חדשה</span>
            <input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} required minLength={6} />
          </label>

          {msg && (
            <div className={`rounded-lg p-3 text-sm ${
              msg.type === 'error'
                ? 'bg-rose-50 border border-rose-200 text-rose-700'
                : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            }`}>
              {msg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button className="btn-primary" disabled={busy}>{busy ? 'שומר...' : 'עדכון סיסמה'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}

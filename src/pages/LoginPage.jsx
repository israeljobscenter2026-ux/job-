import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  if (user) {
    const from = location.state?.from || '/admin';
    navigate(from, { replace: true });
    return null;
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    setError(null);
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const from = location.state?.from || '/admin';
    navigate(from, { replace: true });
  }

  return (
    <div className="relative min-h-screen overflow-hidden grid place-items-center bg-slate-50 px-4">
      <div aria-hidden className="absolute inset-0 bg-mesh pointer-events-none" />
      <div aria-hidden className="absolute -top-32 right-1/4 h-80 w-80 rounded-full bg-brand-300/30 blur-3xl animate-blob" />
      <div aria-hidden className="absolute -bottom-32 left-1/4 h-80 w-80 rounded-full bg-accent-400/25 blur-3xl animate-blob [animation-delay:-8s]" />

      <div className="relative w-full max-w-md animate-fade-up">
        <div className="flex items-center gap-2.5 justify-center mb-6">
          <div className="h-11 w-11 rounded-xl bg-grad-brand grid place-items-center text-white font-bold shadow-glow">L</div>
          <div className="font-bold text-lg">מערכת ניהול לידים</div>
        </div>

        <div className="card p-6 sm:p-7">
          <h1 className="text-2xl font-bold mb-1">ברוכים השבים</h1>
          <p className="text-sm text-slate-500 mb-6">המערכת מיועדת לשני מנהלים מורשים בלבד.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="label">אימייל</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </label>
            <label className="block">
              <span className="label">סיסמה</span>
              <div className="relative">
                <input
                  className="input pl-10"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute inset-y-0 left-0 px-3 text-slate-400 hover:text-slate-600"
                  aria-label={showPw ? 'הסתר סיסמה' : 'הצג סיסמה'}
                >
                  {showPw ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18"/><path d="M10.58 10.58a2 2 0 002.83 2.83"/><path d="M9.88 5.09A9.77 9.77 0 0112 5c5 0 9 5 9 7a13 13 0 01-1.67 2.68"/><path d="M6.61 6.61C4.06 8.27 3 11 3 12c0 2 4 7 9 7a9.77 9.77 0 003-.5"/></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </label>

            {error && (
              <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm p-3 animate-fade-up">
                {error}
              </div>
            )}

            <button className="btn-primary-grad w-full !py-3 text-base" disabled={loading}>
              {loading ? 'מתחבר...' : 'התחברות'}
            </button>
          </form>

          <div className="mt-5 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-xl p-3 leading-relaxed">
            <div className="font-semibold text-slate-700 mb-1">סיסמה ראשונית:</div>
            <code className="font-mono text-slate-800">Admin123!</code>
            <div className="mt-1.5">משתמשים מורשים: <span className="font-mono">salameemel@gmail.com</span>, <span className="font-mono">djelidor4@gmail.com</span></div>
          </div>
        </div>

        <div className="text-center mt-4">
          <Link to="/" className="text-sm text-slate-500 hover:text-slate-700">← חזרה לדף הנחיתה</Link>
        </div>
      </div>
    </div>
  );
}

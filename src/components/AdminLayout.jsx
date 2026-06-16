import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useData } from '../contexts/DataContext.jsx';

const navItems = [
  { to: '/admin', label: 'דשבורד', icon: 'home', end: true },
  { to: '/admin/leads', label: 'פונים', icon: 'users' },
  { to: '/admin/reminders', label: 'תזכורות', icon: 'bell' },
  { to: '/admin/ads', label: 'ניהול פרסומות', icon: 'megaphone' },
  { to: '/admin/areas', label: 'אזורים / אתרים', icon: 'map' },
  { to: '/admin/templates', label: 'תבניות וואטסאפ', icon: 'chat' },
  { to: '/admin/account', label: 'החשבון שלי', icon: 'user' }
];

function Icon({ name }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (name) {
    case 'home': return <svg {...common}><path d="M3 12l9-9 9 9"/><path d="M5 10v10h14V10"/></svg>;
    case 'users': return <svg {...common}><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
    case 'bell': return <svg {...common}><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>;
    case 'map': return <svg {...common}><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>;
    case 'chat': return <svg {...common}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
    case 'megaphone': return <svg {...common}><path d="M3 11v2a1 1 0 001 1h2l4 4V6L6 10H4a1 1 0 00-1 1z"/><path d="M15 5v14a4 4 0 000-14z"/><path d="M18 8l3-2M18 16l3 2M18 12h4"/></svg>;
    case 'user': return <svg {...common}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    default: return null;
  }
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { stats } = useData();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  function onLogout() {
    logout();
    navigate('/login');
  }

  const sidebar = (
    <aside className="w-72 shrink-0 bg-white border-l border-slate-200/80 flex flex-col">
      <div className="px-5 py-5">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-grad-brand grid place-items-center text-white font-bold shadow-glow">L</div>
          <div>
            <div className="font-bold leading-tight">ניהול לידים</div>
            <div className="text-xs text-slate-500 leading-tight">משרות בק אופיס ומוקדים</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 pb-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `nav-link ${isActive ? 'nav-link-active' : ''}`
            }
          >
            <Icon name={item.icon} />
            <span className="flex-1">{item.label}</span>
            {item.to === '/admin/reminders' && stats.reminders > 0 && (
              <span className="badge bg-rose-100 text-rose-700 border border-rose-200">{stats.reminders}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="p-3">
        <div className="rounded-xl bg-grad-brand-soft border border-brand-100 p-3 mb-2">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-full bg-grad-brand grid place-items-center text-white font-semibold text-sm">
              {(user?.name || user?.email || '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs text-slate-500">מחובר/ת בתור</div>
              <div className="text-sm font-semibold truncate">{user?.name || user?.email}</div>
            </div>
          </div>
        </div>
        <button onClick={onLogout} className="btn-secondary w-full">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
          התנתקות
        </button>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">{sidebar}</div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 flex">{sidebar}</div>
        </div>
      )}

      <main className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <button className="btn-ghost !p-2" onClick={() => setMobileOpen(true)} aria-label="פתח תפריט">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
          </button>
          <div className="font-semibold">ניהול לידים</div>
          <div className="w-9" />
        </header>
        <div className="flex-1 p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

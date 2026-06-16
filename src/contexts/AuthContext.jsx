import { createContext, useContext, useMemo, useState } from 'react';
import { getSession, setSession, getUsers, setUsers } from '../lib/storage.js';
import { sha256 } from '../lib/hash.js';

const AuthContext = createContext(null);

function initialUser() {
  const s = getSession();
  if (!s) return null;
  const u = getUsers().find((x) => x.id === s.userId);
  return u ? { id: u.id, email: u.email, name: u.name } : null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(initialUser);
  const ready = true;

  async function login(email, password) {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const u = getUsers().find((x) => x.email.toLowerCase() === normalizedEmail);
    if (!u) return { ok: false, error: 'אימייל או סיסמה אינם נכונים' };
    const hash = await sha256(password);
    if (hash !== u.passwordHash) return { ok: false, error: 'אימייל או סיסמה אינם נכונים' };
    setSession({ userId: u.id, loginAt: new Date().toISOString() });
    setUser({ id: u.id, email: u.email, name: u.name });
    return { ok: true };
  }

  function logout() {
    setSession(null);
    setUser(null);
  }

  async function changePassword(currentPassword, newPassword) {
    if (!user) return { ok: false, error: 'לא מחובר' };
    if (!newPassword || newPassword.length < 6) {
      return { ok: false, error: 'הסיסמה החדשה חייבת להכיל לפחות 6 תווים' };
    }
    const users = getUsers();
    const u = users.find((x) => x.id === user.id);
    if (!u) return { ok: false, error: 'משתמש לא נמצא' };
    const currentHash = await sha256(currentPassword);
    if (currentHash !== u.passwordHash) {
      return { ok: false, error: 'הסיסמה הנוכחית אינה נכונה' };
    }
    u.passwordHash = await sha256(newPassword);
    setUsers(users);
    return { ok: true };
  }

  const value = useMemo(() => ({ user, ready, login, logout, changePassword }), [user, ready]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

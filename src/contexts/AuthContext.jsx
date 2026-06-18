import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

const AuthContext = createContext(null);

function toAppUser(authUser) {
  if (!authUser) return null;
  return {
    id: authUser.id,
    email: authUser.email,
    name: authUser.user_metadata?.name || authUser.email
  };
}

function authError(message) {
  return { ok: false, error: message };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      setReady(true);
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(toAppUser(data.session?.user));
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toAppUser(session?.user));
      setReady(true);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function login(email, password) {
    if (!isSupabaseConfigured) {
      return authError('Supabase לא מוגדר. יש להגדיר VITE_SUPABASE_URL ו-VITE_SUPABASE_ANON_KEY.');
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    if (error) return authError('אימייל או סיסמה אינם נכונים');
    setUser(toAppUser(data.user));
    return { ok: true };
  }

  async function logout() {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    setUser(null);
  }

  async function changePassword(currentPassword, newPassword) {
    if (!isSupabaseConfigured) {
      return authError('Supabase לא מוגדר.');
    }
    if (!user) return authError('לא מחובר');
    if (!newPassword || newPassword.length < 6) {
      return authError('הסיסמה החדשה חייבת להכיל לפחות 6 תווים');
    }

    const verify = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });

    if (verify.error) return authError('הסיסמה הנוכחית אינה נכונה');

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return authError('לא ניתן לעדכן את הסיסמה כרגע');

    return { ok: true };
  }

  const value = useMemo(
    () => ({ user, ready, login, logout, changePassword }),
    [user, ready]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

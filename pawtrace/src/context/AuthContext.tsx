import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { removePushSubscription } from '../lib/push';
import type { User } from '../types';

interface AuthState {
  /** True until the initial session check resolves. */
  loading: boolean;
  /** Null when signed out. */
  user: User | null;
  /** True when running without backend credentials (mock mode). */
  mockMode: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Refresh the local profile (e.g. after reunited_count changes). */
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Used in mock mode so the app is fully usable without a backend.
const MOCK_USER: User = { id: 'mock-user', name: 'Demo Neighbour', reunitedCount: 3 };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const loadProfile = useCallback(async (session: Session | null) => {
    if (!supabase || !session) {
      setUser(null);
      return;
    }
    const authUser = session.user;
    // Fetch the profile row (auto-created by the signup trigger).
    const { data } = await supabase
      .from('profiles')
      .select('id, name, avatar_url, reunited_count')
      .eq('id', authUser.id)
      .single();

    const meta = authUser.user_metadata || {};
    setUser({
      id: authUser.id,
      name: data?.name || meta.full_name || meta.name || authUser.email || 'PawTrace member',
      avatarUrl: data?.avatar_url || meta.avatar_url || undefined,
      reunitedCount: data?.reunited_count ?? 0,
    });
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      // Mock mode: sign in automatically as the demo user.
      setUser(MOCK_USER);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      await loadProfile(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await loadProfile(session);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    // Stop push alerts for this device before the session (and RLS access) goes away.
    await removePushSubscription();
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    await loadProfile(data.session);
  }, [loadProfile]);

  return (
    <AuthContext.Provider value={{ loading, user, mockMode: !isSupabaseConfigured, signInWithGoogle, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

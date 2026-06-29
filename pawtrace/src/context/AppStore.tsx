import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { Pet, Sighting, User, NewPet, NewSighting } from '../types';
import * as service from '../data/petsService';
import { useAuth } from './AuthContext';

interface AppState {
  pets: Pet[];
  loading: boolean;
  error: string | null;
  currentUser: User;
  darkMode: boolean;
  toast: string | null;
  refreshPets: () => Promise<void>;
  addPet: (input: NewPet) => Promise<Pet>;
  addSighting: (input: NewSighting) => Promise<Sighting>;
  markReunited: (id: string) => Promise<void>;
  setDarkMode: (v: boolean) => void;
  showToast: (msg: string) => void;
}

const AppContext = createContext<AppState | null>(null);

// Fallback used only in the brief window before auth resolves; the app is gated
// behind sign-in, so screens always render with a real user.
const GUEST: User = { id: 'guest', name: 'Neighbour', reunitedCount: 0 };

export function AppStore({ children }: { children: React.ReactNode }) {
  const { user, refreshProfile } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [darkMode, setDarkModeState] = useState(() => {
    return localStorage.getItem('darkMode') === 'true';
  });

  const currentUser: User = user ?? GUEST;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  const refreshPets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await service.listPets();
      setPets(data);
    } catch {
      setError('Could not load pets. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refreshPets(); }, [refreshPets]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }, []);

  const addPet = useCallback(async (input: NewPet) => {
    const created = await service.addPet(input);
    setPets(prev => [created, ...prev]);
    return created;
  }, []);

  const addSighting = useCallback(async (input: NewSighting) => {
    const created = await service.addSighting(input);
    setPets(prev => prev.map(p => p.id === input.petId ? { ...p, sightings: [...p.sightings, created] } : p));
    return created;
  }, []);

  const markReunited = useCallback(async (id: string) => {
    await service.markReunited(id, user?.id);
    setPets(prev => prev.map(p => p.id === id ? { ...p, status: 'reunited' as const } : p));
    await refreshProfile();
  }, [user?.id, refreshProfile]);

  const setDarkMode = useCallback((v: boolean) => { setDarkModeState(v); }, []);

  return (
    <AppContext.Provider value={{ pets, loading, error, currentUser, darkMode, toast, refreshPets, addPet, addSighting, markReunited, setDarkMode, showToast }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be inside AppStore');
  return ctx;
}

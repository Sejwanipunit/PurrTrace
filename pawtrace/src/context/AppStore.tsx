import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { Pet, Sighting, User, NewPet, NewSighting } from '../types';
import * as service from '../data/petsService';
import { rowToPet, rowToSighting } from '../data/petsService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { haversine } from '../lib/distance';
import { ensureNotificationPermission, notify } from '../lib/notifications';
import { useAuth } from './AuthContext';

// How close (km) a newly reported found pet must be to one of your lost pets
// before you get a "found pet nearby" notification.
const NEARBY_RADIUS_KM = 3;

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

  // Refs so the realtime callbacks always see the latest pets/user without resubscribing.
  const petsRef = useRef<Pet[]>([]);
  const userIdRef = useRef<string>(currentUser.id);
  useEffect(() => { petsRef.current = pets; }, [pets]);
  useEffect(() => { userIdRef.current = currentUser.id; }, [currentUser.id]);

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

  // Ask for notification permission once a real user is present.
  useEffect(() => {
    if (user) ensureNotificationPermission();
  }, [user]);

  // ----- Realtime: live map updates + proximity notifications -----
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !user) return;
    const sb = supabase;

    const myActiveLostPets = () =>
      petsRef.current.filter(
        p => p.reportedById === userIdRef.current && (p.status === 'lost' || p.status === 'searching')
      );

    const channel = sb
      .channel('pawtrace-live')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pets' }, (payload: any) => {
        const { eventType, new: n, old: o } = payload;
        if (eventType === 'INSERT' && n) {
          const pet = rowToPet(n, []);
          setPets(prev => (prev.some(p => p.id === pet.id) ? prev : [pet, ...prev]));
          // Notify if someone else reported a FOUND pet near one of my lost pets.
          if (pet.reportedById !== userIdRef.current && pet.status === 'found') {
            for (const mine of myActiveLostPets()) {
              const dist = haversine(pet.lastSeen.lat, pet.lastSeen.lng, mine.lastSeen.lat, mine.lastSeen.lng);
              if (dist <= NEARBY_RADIUS_KM) {
                const where = dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`;
                notify(
                  `A found pet was reported near ${mine.name}`,
                  `A ${pet.breed || pet.species} was spotted ${where} from where you lost ${mine.name}. Tap to check.`,
                  () => window.location.assign(`/pet/${pet.id}`)
                );
                break;
              }
            }
          }
        } else if (eventType === 'UPDATE' && n) {
          setPets(prev => prev.map(p => (p.id === n.id ? rowToPet(n, p.sightings) : p)));
        } else if (eventType === 'DELETE' && o) {
          setPets(prev => prev.filter(p => p.id !== o.id));
        }
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'sightings' }, (payload: any) => {
        const s = rowToSighting(payload.new);
        setPets(prev =>
          prev.map(p =>
            p.id === s.petId
              ? (p.sightings.some(x => x.id === s.id) ? p : { ...p, sightings: [...p.sightings, s] })
              : p
          )
        );
        // Notify the owner when someone else reports a sighting of their pet.
        const target = petsRef.current.find(p => p.id === s.petId);
        if (target && target.reportedById === userIdRef.current && s.reportedBy !== currentUser.name) {
          notify(
            `New sighting of ${target.name}`,
            s.note ? s.note : `${target.name} was spotted near ${target.lastSeen.label}. Tap to view.`,
            () => window.location.assign(`/pet/${target.id}`)
          );
        }
      })
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [user, currentUser.name]);

  const addPet = useCallback(async (input: NewPet) => {
    const created = await service.addPet(input);
    setPets(prev => (prev.some(p => p.id === created.id) ? prev : [created, ...prev]));
    return created;
  }, []);

  const addSighting = useCallback(async (input: NewSighting) => {
    const created = await service.addSighting(input);
    setPets(prev => prev.map(p =>
      p.id === input.petId
        ? (p.sightings.some(x => x.id === created.id) ? p : { ...p, sightings: [...p.sightings, created] })
        : p
    ));
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

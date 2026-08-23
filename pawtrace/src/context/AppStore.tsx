import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import type { Pet, Sighting, User, NewPet, NewSighting } from '../types';
import * as service from '../data/petsService';
import { rowToPet, rowToSighting } from '../data/petsService';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { haversine } from '../lib/distance';
import { getCurrentLocation, type Coords } from '../lib/geolocation';
import { ensureNotificationPermission, notify } from '../lib/notifications';
import { ensurePushSubscription, removePushSubscription, isPushActive } from '../lib/push';
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
  /** Whether the user opted into "found pet nearby" / sighting notifications. */
  nearbyAlerts: boolean;
  /** Whether the user opted into sharing their location for distance display. */
  shareLocation: boolean;
  refreshPets: () => Promise<void>;
  addPet: (input: NewPet) => Promise<Pet>;
  updatePet: (id: string, patch: Partial<NewPet>) => Promise<Pet | undefined>;
  deletePet: (id: string) => Promise<void>;
  addSighting: (input: NewSighting) => Promise<Sighting>;
  markReunited: (id: string) => Promise<void>;
  setDarkMode: (v: boolean) => void;
  setNearbyAlerts: (v: boolean) => void;
  setShareLocation: (v: boolean) => void;
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
  const [nearbyAlerts, setNearbyAlertsState] = useState(() => {
    return localStorage.getItem('nearbyAlerts') !== 'false';
  });
  const [shareLocation, setShareLocationState] = useState(() => {
    return localStorage.getItem('shareLocation') === 'true';
  });
  const [userCoords, setUserCoords] = useState<Coords | null>(null);

  const currentUser: User = user ?? GUEST;

  // Refs so the realtime callbacks always see the latest pets/user/settings without resubscribing.
  const petsRef = useRef<Pet[]>([]);
  const userIdRef = useRef<string>(currentUser.id);
  const nearbyAlertsRef = useRef(nearbyAlerts);
  useEffect(() => { petsRef.current = pets; }, [pets]);
  useEffect(() => { userIdRef.current = currentUser.id; }, [currentUser.id]);
  useEffect(() => { nearbyAlertsRef.current = nearbyAlerts; }, [nearbyAlerts]);

  useEffect(() => { localStorage.setItem('nearbyAlerts', String(nearbyAlerts)); }, [nearbyAlerts]);
  useEffect(() => { localStorage.setItem('shareLocation', String(shareLocation)); }, [shareLocation]);

  // When location sharing is on, capture the device position so pets can show
  // real distances (mock data ships with precomputed ones; live data doesn't).
  useEffect(() => {
    if (!shareLocation) { setUserCoords(null); return; }
    let cancelled = false;
    getCurrentLocation()
      .then(c => { if (!cancelled) setUserCoords(c); })
      .catch(() => { if (!cancelled) setShareLocationState(false); });
    return () => { cancelled = true; };
  }, [shareLocation]);

  const enrichedPets = useMemo(() => {
    if (!userCoords) return pets;
    return pets.map(p => ({
      ...p,
      distanceKm: haversine(userCoords.lat, userCoords.lng, p.lastSeen.lat, p.lastSeen.lng),
    }));
  }, [pets, userCoords]);

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

  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((msg: string) => {
    window.clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  // Ask for notification permission once a real user is present, then register
  // this device for Web Push so alerts arrive even when the app is closed.
  useEffect(() => {
    if (!user) return;
    ensureNotificationPermission().then(granted => {
      if (granted && nearbyAlertsRef.current) ensurePushSubscription(user.id);
    });
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
          // (Skipped when push is active — the server sends that notification.)
          if (nearbyAlertsRef.current && !isPushActive() && pet.reportedById !== userIdRef.current && pet.status === 'found') {
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
        // Compare by user id (not display name — names can collide).
        const reporterId: string | null = payload.new?.reported_by ?? null;
        const target = petsRef.current.find(p => p.id === s.petId);
        if (nearbyAlertsRef.current && !isPushActive() && target && target.reportedById === userIdRef.current && reporterId !== userIdRef.current) {
          notify(
            `New sighting of ${target.name}`,
            s.note ? s.note : `${target.name} was spotted near ${target.lastSeen.label}. Tap to view.`,
            () => window.location.assign(`/pet/${target.id}`)
          );
        }
      })
      .subscribe();

    return () => { sb.removeChannel(channel); };
  }, [user]);

  const addPet = useCallback(async (input: NewPet) => {
    const created = await service.addPet(input);
    setPets(prev => (prev.some(p => p.id === created.id) ? prev : [created, ...prev]));
    return created;
  }, []);

  const updatePet = useCallback(async (id: string, patch: Partial<NewPet>) => {
    const updated = await service.updatePet(id, patch);
    if (updated) {
      // The service returns the pet without sightings; keep the ones we have.
      setPets(prev => prev.map(p => (p.id === id ? { ...updated, sightings: p.sightings } : p)));
    }
    return updated;
  }, []);

  const deletePet = useCallback(async (id: string) => {
    await service.deletePet(id);
    setPets(prev => prev.filter(p => p.id !== id));
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
  const setNearbyAlerts = useCallback((v: boolean) => {
    setNearbyAlertsState(v);
    // Keep the device's push registration in sync with the setting.
    if (v) {
      if (user) ensureNotificationPermission().then(g => { if (g) ensurePushSubscription(user.id); });
    } else {
      removePushSubscription();
    }
  }, [user]);
  const setShareLocation = useCallback((v: boolean) => { setShareLocationState(v); }, []);

  return (
    <AppContext.Provider value={{ pets: enrichedPets, loading, error, currentUser, darkMode, toast, nearbyAlerts, shareLocation, refreshPets, addPet, updatePet, deletePet, addSighting, markReunited, setDarkMode, setNearbyAlerts, setShareLocation, showToast }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppStore() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppStore must be inside AppStore');
  return ctx;
}

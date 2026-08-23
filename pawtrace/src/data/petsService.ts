import type { Pet, Sighting, NewPet, NewSighting } from '../types';
import { mockPets } from './mockPets';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

// ============================================================================
// Row mappers (snake_case DB → camelCase app types)
// ============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */
export function rowToSighting(r: any): Sighting {
  return {
    id: r.id,
    petId: r.pet_id,
    lat: r.lat,
    lng: r.lng,
    note: r.note ?? undefined,
    photoUrl: r.photo_url ?? undefined,
    at: r.at,
    reportedBy: r.reported_by_name ?? 'PawTrace member',
  };
}

export function rowToPet(r: any, sightings: Sighting[]): Pet {
  return {
    id: r.id,
    name: r.name,
    species: r.species,
    breed: r.breed ?? undefined,
    ageYears: r.age_years ?? undefined,
    status: r.status,
    photoUrl: r.photo_url ?? undefined,
    description: r.description ?? undefined,
    microchipId: r.microchip_id ?? undefined,
    lastSeen: {
      lat: r.last_seen_lat,
      lng: r.last_seen_lng,
      label: r.last_seen_label,
      at: r.last_seen_at,
    },
    distanceKm: undefined,
    sightings,
    reportedBy: r.reported_by_name ?? 'PawTrace member',
    reportedById: r.reported_by ?? undefined,
    createdAt: r.created_at,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ============================================================================
// Mock fallback (used when Supabase is not configured)
// ============================================================================
let pets: Pet[] = [...mockPets];
const delay = (ms = 250) => new Promise(r => setTimeout(r, ms));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random()}`);

// ============================================================================
// Public API — switches between Supabase and mock based on configuration
// ============================================================================

export async function listPets(): Promise<Pet[]> {
  if (isSupabaseConfigured && supabase) {
    const { data: petRows, error } = await supabase
      .from('pets')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    const ids = (petRows ?? []).map(p => p.id);
    let sightingRows: any[] = []; // eslint-disable-line @typescript-eslint/no-explicit-any
    if (ids.length) {
      const { data: sRows } = await supabase
        .from('sightings')
        .select('*')
        .in('pet_id', ids)
        .order('at', { ascending: true });
      sightingRows = sRows ?? [];
    }
    return (petRows ?? []).map(p =>
      rowToPet(p, sightingRows.filter(s => s.pet_id === p.id).map(rowToSighting))
    );
  }

  await delay();
  return [...pets];
}

export async function getPet(id: string): Promise<Pet | undefined> {
  if (isSupabaseConfigured && supabase) {
    const { data: petRow, error } = await supabase.from('pets').select('*').eq('id', id).single();
    if (error || !petRow) return undefined;
    const { data: sRows } = await supabase
      .from('sightings')
      .select('*')
      .eq('pet_id', id)
      .order('at', { ascending: true });
    return rowToPet(petRow, (sRows ?? []).map(rowToSighting));
  }

  await delay();
  return pets.find(p => p.id === id);
}

export async function addPet(input: NewPet): Promise<Pet> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('pets')
      .insert({
        name: input.name,
        species: input.species,
        breed: input.breed ?? null,
        age_years: input.ageYears ?? null,
        status: input.status,
        photo_url: input.photoUrl ?? null,
        description: input.description ?? null,
        microchip_id: input.microchipId ?? null,
        last_seen_lat: input.lastSeen.lat,
        last_seen_lng: input.lastSeen.lng,
        last_seen_label: input.lastSeen.label,
        last_seen_at: input.lastSeen.at,
        reported_by: input.reportedById,
        reported_by_name: input.reportedByName,
      })
      .select('*')
      .single();
    if (error) throw error;
    return rowToPet(data, []);
  }

  await delay();
  const pet: Pet = {
    id: uid(),
    name: input.name,
    species: input.species,
    breed: input.breed,
    ageYears: input.ageYears,
    status: input.status,
    photoUrl: input.photoUrl,
    description: input.description,
    microchipId: input.microchipId,
    lastSeen: input.lastSeen,
    distanceKm: 0.5,
    sightings: [],
    reportedBy: input.reportedByName,
    reportedById: input.reportedById,
    createdAt: new Date().toISOString(),
  };
  pets = [pet, ...pets];
  return pet;
}

export async function addSighting(input: NewSighting): Promise<Sighting> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('sightings')
      .insert({
        pet_id: input.petId,
        lat: input.lat,
        lng: input.lng,
        note: input.note ?? null,
        photo_url: input.photoUrl ?? null,
        reported_by: input.reportedById,
        reported_by_name: input.reportedByName,
      })
      .select('*')
      .single();
    if (error) throw error;
    return rowToSighting(data);
  }

  await delay();
  const sighting: Sighting = {
    id: uid(),
    petId: input.petId,
    lat: input.lat,
    lng: input.lng,
    note: input.note,
    photoUrl: input.photoUrl,
    at: new Date().toISOString(),
    reportedBy: input.reportedByName,
  };
  pets = pets.map(p => (p.id === input.petId ? { ...p, sightings: [...p.sightings, sighting] } : p));
  return sighting;
}

/** Update an existing report. Only fields present in the patch are changed. */
export async function updatePet(id: string, patch: Partial<NewPet>): Promise<Pet | undefined> {
  if (isSupabaseConfigured && supabase) {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.species !== undefined) row.species = patch.species;
    if ('breed' in patch) row.breed = patch.breed ?? null;
    if ('ageYears' in patch) row.age_years = patch.ageYears ?? null;
    if (patch.status !== undefined) row.status = patch.status;
    if ('photoUrl' in patch) row.photo_url = patch.photoUrl ?? null;
    if ('description' in patch) row.description = patch.description ?? null;
    if ('microchipId' in patch) row.microchip_id = patch.microchipId ?? null;
    if (patch.lastSeen) {
      row.last_seen_lat = patch.lastSeen.lat;
      row.last_seen_lng = patch.lastSeen.lng;
      row.last_seen_label = patch.lastSeen.label;
      row.last_seen_at = patch.lastSeen.at;
    }
    const { data, error } = await supabase
      .from('pets')
      .update(row)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return rowToPet(data, []);
  }

  await delay();
  pets = pets.map(p =>
    p.id === id
      ? {
          ...p,
          name: patch.name ?? p.name,
          species: patch.species ?? p.species,
          breed: 'breed' in patch ? patch.breed : p.breed,
          ageYears: 'ageYears' in patch ? patch.ageYears : p.ageYears,
          status: patch.status ?? p.status,
          photoUrl: 'photoUrl' in patch ? patch.photoUrl : p.photoUrl,
          description: 'description' in patch ? patch.description : p.description,
          microchipId: 'microchipId' in patch ? patch.microchipId : p.microchipId,
          lastSeen: patch.lastSeen ?? p.lastSeen,
        }
      : p
  );
  return pets.find(p => p.id === id);
}

/** Delete a report (sightings cascade in the DB). */
export async function deletePet(id: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.from('pets').delete().eq('id', id);
    if (error) throw error;
    return;
  }

  await delay();
  pets = pets.filter(p => p.id !== id);
}

export async function markReunited(id: string, ownerId?: string): Promise<Pet | undefined> {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('pets')
      .update({ status: 'reunited' })
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    if (ownerId) {
      await supabase.rpc('increment_reunited', { uid: ownerId });
    }
    return rowToPet(data, []);
  }

  await delay();
  pets = pets.map(p => (p.id === id ? { ...p, status: 'reunited' as const } : p));
  return pets.find(p => p.id === id);
}

/**
 * Upload a photo to Supabase Storage and return its public URL.
 * In mock mode, returns a local object URL so the preview still shows the image.
 */
export async function uploadPhoto(file: File, userId: string): Promise<string> {
  if (isSupabaseConfigured && supabase) {
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `${userId}/${uid()}.${ext}`;
    const { error } = await supabase.storage.from('pet-photos').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from('pet-photos').getPublicUrl(path);
    return data.publicUrl;
  }

  await delay(150);
  return URL.createObjectURL(file);
}

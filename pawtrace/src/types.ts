export type PetStatus = 'lost' | 'found' | 'searching' | 'reunited';
export type Species = 'dog' | 'cat' | 'other';

export interface Sighting {
  id: string;
  petId: string;
  lat: number;
  lng: number;
  note?: string;
  photoUrl?: string;
  at: string;
  reportedBy: string;
}

export interface Pet {
  id: string;
  name: string;
  species: Species;
  breed?: string;
  color?: string;            // e.g. "golden", "black & white"
  ageYears?: number;
  status: PetStatus;
  photoUrl?: string;
  description?: string;
  microchipId?: string;
  reward?: string;           // optional reward offer, e.g. "₹5,000"
  lastSeen: { lat: number; lng: number; label: string; at: string };
  distanceKm?: number;
  sightings: Sighting[];
  reportedBy: string;        // display name
  reportedById?: string;     // owner user id (for ownership checks)
  createdAt: string;
}

/** Payload for creating a pet — id/createdAt/sightings are assigned by the backend. */
export interface NewPet {
  name: string;
  species: Species;
  breed?: string;
  color?: string;
  ageYears?: number;
  status: PetStatus;
  photoUrl?: string;
  description?: string;
  microchipId?: string;
  reward?: string;
  lastSeen: { lat: number; lng: number; label: string; at: string };
  reportedById: string;
  reportedByName: string;
}

/** Payload for creating a sighting. */
export interface NewSighting {
  petId: string;
  lat: number;
  lng: number;
  note?: string;
  photoUrl?: string;
  reportedById: string;
  reportedByName: string;
}

export interface User {
  id: string;
  name: string;
  avatarUrl?: string;
  reunitedCount: number;
}

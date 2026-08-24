import { supabase, isSupabaseConfigured } from './supabase';
import type { Pet, Species } from '../types';

export interface PetDescription {
  species: Species;
  breed: string;
  color: string;
  markings: string;
  description: string;
}

export interface PetMatch {
  id: string;
  confidence: number; // 0-100
  reasoning: string;
}

/** AI features need the deployed backend (Edge Function). */
export const isAIAvailable = isSupabaseConfigured;

function fileToBase64(file: File): Promise<{ data: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string; // data:<mime>;base64,<data>
      const [meta, data] = result.split(',');
      const mediaType = meta.slice(meta.indexOf(':') + 1, meta.indexOf(';')) || file.type || 'image/jpeg';
      resolve({ data, mediaType });
    };
    reader.onerror = () => reject(new Error('Could not read the image'));
    reader.readAsDataURL(file);
  });
}

/** Identify species/breed/colour/markings + a draft description from a photo. */
export async function describePetPhoto(file: File): Promise<PetDescription | null> {
  if (!isSupabaseConfigured || !supabase) {
    // Demo/mock fallback so the flow is usable without a backend.
    await new Promise(r => setTimeout(r, 900));
    return {
      species: 'dog',
      breed: 'Labrador Retriever (demo)',
      color: 'golden',
      markings: 'white chest patch, medium build',
      description: 'A friendly, medium-sized dog with a golden coat and a small white patch on the chest. Alert expression and a well-kept appearance.',
    };
  }

  const { data: imageBase64, mediaType } = await fileToBase64(file);
  const { data, error } = await supabase.functions.invoke('pet-ai', {
    body: { action: 'describe', imageBase64, mediaType },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.detail || data.error);
  return (data?.result as PetDescription) ?? null;
}

interface MatchSubject { imageUrl: string; name?: string; species?: string; breed?: string; }
interface MatchCandidate extends MatchSubject { id: string; }

/** Ask Claude which candidate pets could be the same animal as the subject. */
export async function findPossibleMatches(subject: MatchSubject, candidates: MatchCandidate[]): Promise<PetMatch[]> {
  if (candidates.length === 0) return [];

  if (!isSupabaseConfigured || !supabase) {
    // Demo/mock fallback: fabricate a plausible ranked result from the candidates.
    await new Promise(r => setTimeout(r, 1100));
    return candidates.slice(0, 2).map((c, i) => ({
      id: c.id,
      confidence: i === 0 ? 78 : 51,
      reasoning: 'Similar coat colour and markings to the subject (demo result — connect Anthropic API for real matching).',
    }));
  }

  const { data, error } = await supabase.functions.invoke('pet-ai', {
    body: { action: 'match', subject, candidates },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.detail || data.error);
  const matches = (data?.result?.matches ?? []) as PetMatch[];
  return matches.filter(m => m && typeof m.confidence === 'number').sort((a, b) => b.confidence - a.confidence);
}

/** Build match candidates from the store: opposite-status pets that could pair with this one. */
export function candidatesFor(pet: Pet, allPets: Pet[]): Pet[] {
  const wantLostSide = pet.status === 'found';
  return allPets.filter(p => {
    if (p.id === pet.id || !p.photoUrl) return false;
    if (p.species !== pet.species) return false;
    return wantLostSide
      ? (p.status === 'lost' || p.status === 'searching')
      : p.status === 'found';
  });
}

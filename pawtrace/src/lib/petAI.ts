import type { Pet, Species } from '../types';
import { classify, embed, loadImageEl, cosineSimilarity, dominantColor } from './petVision';

export interface PetDetection {
  species: Species;
  breeds: string[];   // best guesses, most likely first
  color: string;
  description: string; // short, clean
}

export interface PetMatch {
  id: string;
  confidence: number; // 0-100
  reasoning: string;
}

// On-device ML runs everywhere (no backend/keys needed).
export const isAIAvailable = true;

const CAT_HINTS = ['cat', 'tabby', 'siamese', 'persian', 'egyptian', 'lynx', 'kitten'];
const DOG_HINTS = [
  'dog', 'puppy', 'retriever', 'terrier', 'spaniel', 'poodle', 'bulldog', 'beagle', 'hound',
  'shepherd', 'collie', 'husky', 'pug', 'boxer', 'dalmatian', 'rottweiler', 'chihuahua', 'corgi',
  'mastiff', 'dane', 'doberman', 'setter', 'pointer', 'labrador', 'malamute', 'samoyed', 'akita',
  'shih-tzu', 'shih tzu', 'pekinese', 'pomeranian', 'schnauzer', 'whippet', 'greyhound', 'dachshund',
  'ridgeback', 'pinscher', 'spitz', 'griffon', 'sheepdog', 'wolfhound', 'vizsla', 'weimaraner',
];

function speciesFromLabels(labels: string[]): Species {
  const joined = labels.join(' ').toLowerCase();
  if (CAT_HINTS.some(h => joined.includes(h))) return 'cat';
  if (DOG_HINTS.some(h => joined.includes(h))) return 'dog';
  return 'other';
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

/** Detect species / breed guesses / colour + a short description from a photo, on-device. */
export async function describePetPhoto(file: File): Promise<PetDetection | null> {
  const img = await loadImageEl(file);
  const results = await classify(img, 6);
  if (!results.length) return null;

  const labels = results.map(r => r.className);
  const species = speciesFromLabels(labels);
  const color = dominantColor(img);

  // Up to 3 distinct breed guesses (first segment before a comma), most likely first.
  const breeds = species === 'other'
    ? []
    : [...new Set(results.map(r => titleCase(r.className.split(',')[0].trim())))].slice(0, 3);

  // Short, clean description — no "AI generated" boilerplate.
  const primary = breeds[0] || (species === 'other' ? 'pet' : species);
  const description = color ? `${titleCase(color)} ${primary}.` : `${titleCase(primary)}.`;

  return { species, breeds, color, description };
}

interface MatchSubject { imageUrl: string; name?: string; species?: string; breed?: string; }
interface MatchCandidate extends MatchSubject { id: string; }

function reasoningFor(sim: number): string {
  if (sim >= 0.8) return 'Strong visual similarity in colour and shape.';
  if (sim >= 0.65) return 'Notable visual similarity.';
  return 'Some visual similarity — worth a closer look.';
}

/**
 * Rank candidate pets by visual similarity to the subject, using MobileNet
 * image embeddings + cosine similarity. Fully on-device.
 */
export async function findPossibleMatches(subject: MatchSubject, candidates: MatchCandidate[]): Promise<PetMatch[]> {
  if (candidates.length === 0) return [];

  const subjectImg = await loadImageEl(subject.imageUrl);
  const subjectVec = await embed(subjectImg);

  const scored: PetMatch[] = [];
  for (const c of candidates.slice(0, 8)) {
    try {
      const img = await loadImageEl(c.imageUrl);
      const vec = await embed(img);
      const sim = cosineSimilarity(subjectVec, vec);
      if (sim >= 0.5) {
        scored.push({ id: c.id, confidence: Math.round(sim * 100), reasoning: reasoningFor(sim) });
      }
    } catch {
      // skip a candidate whose image can't be loaded (e.g. CORS)
    }
  }
  return scored.sort((a, b) => b.confidence - a.confidence).slice(0, 4);
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

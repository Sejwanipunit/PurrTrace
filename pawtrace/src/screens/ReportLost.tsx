import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import { Button } from '../components/Button';
import { PawIcon } from '../components/PawPath';
import { LocationPicker } from '../components/LocationPicker';
import { uploadPhoto } from '../data/petsService';
import { getCurrentLocation, reverseGeocode, geocodeLabel, type Coords } from '../lib/geolocation';
import { describePetPhoto } from '../lib/petAI';
import type { NewPet, Species } from '../types';
import './ReportLost.css';

const titleCaseWord = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

interface FormData {
  name: string;
  species: Species | '';
  breed: string;
  color: string;
  ageYears: string;
  description: string;
  microchipId: string;
  reward: string;
  photoUrl: string;
  locationLabel: string;
  locationLat: string;
  locationLng: string;
}

interface Errors {
  [k: string]: string;
}

const INITIAL: FormData = {
  name: '', species: '', breed: '', color: '', ageYears: '', description: '',
  microchipId: '', reward: '', photoUrl: '', locationLabel: '', locationLat: '', locationLng: '',
};

function validateStep1(f: FormData, isFound: boolean): Errors {
  const e: Errors = {};
  if (!isFound && !f.name.trim()) e.name = 'Name is required.'; // finders often don't know the name
  if (!f.species) e.species = 'Please select a species.';
  return e;
}

function validateStep3(f: FormData): Errors {
  const e: Errors = {};
  if (!f.locationLabel.trim()) e.locationLabel = 'Last seen location is required.';
  return e;
}

function StepIndicator({ step }: { step: number }) {
  const steps = ['Photo', 'Details', 'Location'];
  return (
    <div className="step-indicator" role="group" aria-label="Progress">
      {steps.map((label, i) => {
        const idx = i + 1;
        const state = idx < step ? 'done' : idx === step ? 'active' : 'future';
        return (
          <React.Fragment key={label}>
            <div className={`step-node step-${state}`}>
              <div className="step-circle" aria-current={idx === step ? 'step' : undefined}>
                {state === 'done' ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="14" height="14">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <span>{idx}</span>
                )}
              </div>
              <span className="step-label">{label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`step-line ${state === 'done' ? 'step-line-done' : ''}`} aria-hidden="true" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="field-error t-body-s" role="alert">{msg}</p>;
}

function TextField({ label, id, required, error, hint, ...props }: { label: string; id: string; required?: boolean; error?: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field-group">
      <label className="field-label t-label" htmlFor={id}>
        {label}{required && <span aria-hidden="true" style={{ color: 'var(--coral-500)' }}> *</span>}
      </label>
      <input id={id} className={`field-input ${error ? 'field-input-error' : ''}`} aria-required={required} aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined} {...props} />
      {hint && !error && <p className="field-hint t-body-s" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="field-error t-body-s" id={`${id}-err`} role="alert">{error}</p>}
    </div>
  );
}

function TextArea({ label, id, required, error, ...props }: { label: string; id: string; required?: boolean; error?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="field-group">
      <label className="field-label t-label" htmlFor={id}>
        {label}{required && <span aria-hidden="true" style={{ color: 'var(--coral-500)' }}> *</span>}
      </label>
      <textarea id={id} className={`field-input field-textarea ${error ? 'field-input-error' : ''}`} rows={3} aria-required={required} {...props} />
      {error && <p className="field-error t-body-s" role="alert">{error}</p>}
    </div>
  );
}

export function ReportLost({ status = 'lost' }: { status?: 'lost' | 'found' }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { pets, loading, addPet, updatePet, showToast, currentUser } = useAppStore();
  const navigate = useNavigate();

  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [locMessage, setLocMessage] = useState('');

  const [aiStatus, setAiStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [aiMessage, setAiMessage] = useState('');

  // Breed & colour are captured as editable tiles (from AI or added manually).
  interface Tag { id: string; kind: 'breed' | 'color'; label: string; value: string; applied: boolean; }
  const [tags, setTags] = useState<Tag[]>([]);
  const [breedInput, setBreedInput] = useState('');
  const [colorInput, setColorInput] = useState('');

  const speciesLabel = (s: string) => (s === 'dog' ? 'Dog' : s === 'cat' ? 'Cat' : 'Other');

  // Keep the form's breed/color in sync with the applied tiles (tiles are the source of truth).
  const syncFromTags = (list: Tag[]) => {
    setForm(prev => {
      const next = { ...prev };
      (['breed', 'color'] as const).forEach(kind => {
        const present = list.filter(t => t.kind === kind);
        if (present.length === 0) return; // no tile of this kind → leave field untouched
        next[kind] = (present.find(t => t.applied)?.value ?? '') as never;
      });
      return next;
    });
  };

  // Only one tile of each kind is "applied" at a time.
  const toggleTag = (id: string) => {
    setTags(prev => {
      const target = prev.find(t => t.id === id);
      const next = prev.map(t => {
        if (t.id === id) return { ...t, applied: !t.applied };
        if (target && t.kind === target.kind && !target.applied) return { ...t, applied: false };
        return t;
      });
      syncFromTags(next);
      return next;
    });
  };

  const removeTag = (id: string) => {
    setTags(prev => {
      const removed = prev.find(t => t.id === id);
      const next = prev.filter(t => t.id !== id);
      if (removed?.applied && !next.some(t => t.kind === removed.kind && t.applied)) {
        setForm(f => ({ ...f, [removed.kind]: '' as never }));
      }
      syncFromTags(next);
      return next;
    });
  };

  const addCustomTag = (kind: 'breed' | 'color', raw: string) => {
    const value = raw.trim();
    if (!value) return;
    setTags(prev => {
      const next: Tag[] = [
        ...prev.map(t => (t.kind === kind ? { ...t, applied: false } : t)),
        { id: `${kind}-${Date.now()}`, kind, label: titleCaseWord(value), value: kind === 'color' ? value.toLowerCase() : value, applied: true },
      ];
      syncFromTags(next);
      return next;
    });
  };

  // Feature: detect species/breed/colour from the photo, on-device (TensorFlow.js).
  const detectFromPhoto = async () => {
    if (!photoFile) return;
    setAiStatus('loading');
    setAiMessage('Looking at the photo…');
    try {
      const d = await describePetPhoto(photoFile);
      if (!d) throw new Error('No result');
      // Species fills the (required) select directly; breed & colour become editable tiles.
      const newTags: Tag[] = [];
      d.breeds.forEach((b, i) => newTags.push({ id: `breed-${i}`, kind: 'breed', label: b, value: b, applied: i === 0 }));
      if (d.color) newTags.push({ id: 'color-0', kind: 'color', label: titleCaseWord(d.color), value: d.color, applied: true });
      setTags(newTags);
      setForm(prev => ({
        ...prev,
        species: (d.species || prev.species) as Species | '',
        breed: newTags.find(t => t.kind === 'breed' && t.applied)?.value || prev.breed,
        color: d.color || prev.color,
        description: prev.description || d.description,
      }));
      setErrors(prev => { const n = { ...prev }; delete n.species; return n; });
      const summary = [speciesLabel(d.species), d.breeds[0], d.color && titleCaseWord(d.color)].filter(Boolean).join(' · ');
      setAiStatus('done');
      setAiMessage(`Tagged: ${summary} — review under Details`);
    } catch {
      setAiStatus('error');
      setAiMessage('Couldn’t read the photo — add breed & colour under Details.');
    }
  };

  // ----- Edit mode (/edit/:id): prefill from the existing report -----
  const { id: editId } = useParams<{ id: string }>();
  const editingPet = editId ? pets.find(p => p.id === editId) : undefined;
  const isEdit = Boolean(editId);
  const isFound = isEdit ? editingPet?.status === 'found' : status === 'found';
  const prefilled = useRef(false);

  useEffect(() => {
    if (!editingPet || prefilled.current) return;
    prefilled.current = true;
    setForm({
      name: editingPet.name,
      species: editingPet.species,
      breed: editingPet.breed ?? '',
      color: editingPet.color ?? '',
      ageYears: editingPet.ageYears != null ? String(editingPet.ageYears) : '',
      description: editingPet.description ?? '',
      microchipId: editingPet.microchipId ?? '',
      reward: editingPet.reward ?? '',
      photoUrl: editingPet.photoUrl ?? '',
      locationLabel: editingPet.lastSeen.label,
      locationLat: editingPet.lastSeen.lat.toFixed(5),
      locationLng: editingPet.lastSeen.lng.toFixed(5),
    });
    // Seed breed/colour tiles from the existing report so they're editable.
    const seeded: Tag[] = [];
    if (editingPet.breed) seeded.push({ id: 'breed-0', kind: 'breed', label: editingPet.breed, value: editingPet.breed, applied: true });
    if (editingPet.color) seeded.push({ id: 'color-0', kind: 'color', label: titleCaseWord(editingPet.color), value: editingPet.color, applied: true });
    setTags(seeded);
  }, [editingPet]);

  // Only the reporter may edit; bounce everyone else back.
  useEffect(() => {
    if (!isEdit || loading) return;
    if (!editingPet || editingPet.reportedById !== currentUser.id) {
      navigate(editingPet ? `/pet/${editingPet.id}` : '/', { replace: true });
    }
  }, [isEdit, loading, editingPet, currentUser.id, navigate]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      showToast('That photo is too large — please pick one under 8 MB.');
      e.target.value = '';
      return;
    }
    setPhotoFile(file);
    setForm(prev => ({ ...prev, photoUrl: URL.createObjectURL(file) }));
  };

  const captureLocation = async () => {
    setLocStatus('loading');
    setLocMessage('Getting your location…');
    try {
      const { lat, lng } = await getCurrentLocation();
      setForm(prev => ({ ...prev, locationLat: lat.toFixed(5), locationLng: lng.toFixed(5) }));
      const label = await reverseGeocode(lat, lng);
      if (label) setForm(prev => ({ ...prev, locationLabel: prev.locationLabel || label }));
      setLocStatus('done');
      setLocMessage(label ? `Pinned · ${label}` : 'Location pinned');
      setErrors(prev => { const n = { ...prev }; delete n.locationLabel; return n; });
    } catch (err) {
      setLocStatus('error');
      setLocMessage(err instanceof Error ? err.message : 'Couldn’t get your location.');
    }
  };

  // Picked spot shown on the mini map; coordinates live in the form state.
  const pickedLocation: Coords | null =
    form.locationLat && form.locationLng
      ? { lat: Number(form.locationLat), lng: Number(form.locationLng) }
      : null;

  const onPickLocation = async ({ lat, lng }: Coords) => {
    setForm(prev => ({ ...prev, locationLat: lat.toFixed(5), locationLng: lng.toFixed(5) }));
    setErrors(prev => { const n = { ...prev }; delete n.locationLabel; return n; });
    setLocStatus('done');
    setLocMessage('Location pinned');
    const label = await reverseGeocode(lat, lng);
    if (label) {
      setForm(prev => ({ ...prev, locationLabel: prev.locationLabel || label }));
      setLocMessage(`Pinned · ${label}`);
    }
  };

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [k]: e.target.value }));
    if (errors[k]) setErrors(prev => { const n = { ...prev }; delete n[k]; return n; });
  };

  const nextStep = () => {
    if (step === 1) {
      const e = validateStep1(form, isFound);
      if (Object.keys(e).length) { setErrors(e); return; }
    }
    setStep(s => s + 1);
  };

  const submit = async () => {
    const e = validateStep3(form);
    if (Object.keys(e).length) { setErrors(e); return; }

    setSubmitting(true);
    try {
      // Upload a chosen file, else fall back to a pasted URL, else a placeholder.
      let photoUrl = form.photoUrl.trim() || undefined;
      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile, currentUser.id);
      }
      if (!photoUrl) {
        photoUrl = `https://picsum.photos/seed/${encodeURIComponent(form.name.trim())}/400/300`;
      }

      // Resolve coordinates: manual entry > geocoded location name. Never pin
      // the report to an arbitrary default city.
      let lat = Number(form.locationLat);
      let lng = Number(form.locationLng);
      if (!lat || !lng) {
        const geo = await geocodeLabel(form.locationLabel.trim());
        if (!geo) {
          setErrors({ locationLabel: 'We couldn’t find that place — tap the map to drop a pin or use your current location.' });
          setSubmitting(false);
          return;
        }
        lat = geo.lat;
        lng = geo.lng;
      }

      if (isEdit && editingPet) {
        await updatePet(editingPet.id, {
          name: form.name.trim(),
          species: form.species as Species,
          breed: form.breed.trim() || undefined,
          color: form.color.trim() || undefined,
          ageYears: form.ageYears ? Number(form.ageYears) : undefined,
          photoUrl,
          description: form.description.trim() || undefined,
          microchipId: form.microchipId.trim() || undefined,
          reward: form.reward.trim() || undefined,
          lastSeen: {
            lat,
            lng,
            label: form.locationLabel.trim(),
            // Keep the original sighting time unless the spot actually moved.
            at:
              lat === editingPet.lastSeen.lat && lng === editingPet.lastSeen.lng
                ? editingPet.lastSeen.at
                : new Date().toISOString(),
          },
        });
        showToast('Report updated');
        navigate(`/pet/${editingPet.id}`);
        return;
      }

      // Finders often don't know the pet's name — fall back to a friendly stray label.
      const fallbackName = `Unknown ${form.breed.trim() || (form.species === 'other' ? 'pet' : form.species)}`;
      const input: NewPet = {
        name: form.name.trim() || (isFound ? fallbackName : ''),
        species: form.species as Species,
        breed: form.breed.trim() || undefined,
        color: form.color.trim() || undefined,
        ageYears: form.ageYears ? Number(form.ageYears) : undefined,
        status: isFound ? 'found' : 'lost',
        photoUrl,
        description: form.description.trim() || undefined,
        microchipId: form.microchipId.trim() || undefined,
        reward: isFound ? undefined : (form.reward.trim() || undefined),
        lastSeen: {
          lat,
          lng,
          label: form.locationLabel.trim(),
          at: new Date().toISOString(),
        },
        reportedById: currentUser.id,
        reportedByName: currentUser.name,
      };
      const created = await addPet(input);
      showToast(isFound ? `${created.name} reported as found 🐾` : `${created.name} has been reported as lost`);
      navigate(`/pet/${created.id}`);
    } catch {
      setErrors({ locationLabel: 'We couldn’t save that report — please try again.' });
      setSubmitting(false);
    }
  };

  return (
    <div className={`report-lost screen-content ${isFound ? 'report-found' : ''}`}>
      <header className="report-header">
        <button className="back-btn" onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)} aria-label="Go back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" width="22" height="22">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div>
          <h1 className="t-headline">{isEdit ? 'Edit report' : isFound ? 'Report a found pet' : 'Report a lost pet'}</h1>
          <p className="t-body-s" style={{ color: 'var(--bark-500)' }}>
            {isEdit ? `Update ${editingPet?.name ?? 'your pet'}’s details` : isFound ? 'Let’s help reunite them' : 'Help us help you find them'}
          </p>
        </div>
      </header>

      <div className="report-body">
        <StepIndicator step={step} />

        {/* Step 1: Photo */}
        {step === 1 && (
          <div className="step-content">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={onPickFile}
              style={{ display: 'none' }}
              aria-hidden="true"
              tabIndex={-1}
            />
            <div className="photo-upload-area">
              {form.photoUrl ? (
                <div className="photo-preview">
                  <img src={form.photoUrl} alt="Pet preview" />
                  <button className="photo-remove" onClick={() => { setForm(p => ({ ...p, photoUrl: '' })); setPhotoFile(null); }} aria-label="Remove photo">×</button>
                </div>
              ) : (
                <button type="button" className="photo-placeholder" onClick={() => fileInputRef.current?.click()}>
                  <PawIcon size={48} color="var(--sprout-300)" />
                  <p className="t-body-m" style={{ color: 'var(--bark-500)' }}>Add a photo</p>
                  <p className="t-body-s" style={{ color: 'var(--bark-300)' }}>Tap to choose from your device</p>
                </button>
              )}
            </div>

            {photoFile && (
              <>
                <button
                  type="button"
                  className={`ai-detect-btn ${tags.length ? 'ai-detect-done' : ''}`}
                  onClick={detectFromPhoto}
                  disabled={aiStatus === 'loading'}
                >
                  <span className="ai-spark" aria-hidden="true">✨</span>
                  {aiStatus === 'loading' ? 'Reading photo…' : tags.length ? 'Scan photo again' : 'Detect tags with AI'}
                </button>

                {aiMessage && (
                  <p className={`ai-status t-body-s ${aiStatus === 'error' ? 'ai-status-error' : ''}`} role="status">
                    {aiMessage}
                  </p>
                )}
              </>
            )}

            <TextField
              label="Or paste a photo URL (optional)"
              id="photoUrl"
              type="url"
              placeholder="https://…"
              value={form.photoUrl.startsWith('blob:') ? '' : form.photoUrl}
              onChange={(e) => { setPhotoFile(null); set('photoUrl')(e); }}
              hint="Upload above, paste a direct image link, or leave blank for a placeholder"
            />

            <div className="field-group">
              <label className="field-label t-label" htmlFor="species">
                Species <span aria-hidden="true" style={{ color: 'var(--coral-500)' }}>*</span>
              </label>
              <select id="species" className={`field-input ${errors.species ? 'field-input-error' : ''}`} value={form.species} onChange={set('species')} aria-required>
                <option value="">Select species…</option>
                <option value="dog">Dog</option>
                <option value="cat">Cat</option>
                <option value="other">Other</option>
              </select>
              <FieldError msg={errors.species} />
            </div>

            <TextField
              label={isFound ? "Pet's name (if you know it)" : "Pet's name"}
              id="name"
              placeholder={isFound ? 'Leave blank if unknown' : 'e.g. Bruno'}
              value={form.name}
              onChange={set('name')}
              required={!isFound}
              error={errors.name}
              hint={isFound ? 'A stray? Leave this blank — we’ll label it for you.' : undefined}
            />

            <Button variant="primary" fullWidth onClick={nextStep}>Continue →</Button>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="step-content">
            {/* Breed & colour as editable tiles (from AI detect or added manually) */}
            <div className="field-group">
              <span className="field-label t-label">Breed &amp; colour</span>
              {tags.length > 0 ? (
                <div className="tag-list">
                  {tags.map(t => (
                    <span key={t.id} className={`tag-chip tag-${t.kind} ${t.applied ? 'tag-on' : ''}`}>
                      <button type="button" className="tag-label" onClick={() => toggleTag(t.id)} aria-pressed={t.applied}>
                        {t.applied && <span aria-hidden="true">✓ </span>}{t.label}
                      </button>
                      <button type="button" className="tag-x" onClick={() => removeTag(t.id)} aria-label={`Remove ${t.label}`}>×</button>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="field-hint t-body-s">Add a photo in step 1 to auto-detect, or add them below.</p>
              )}
              <div className="tag-add-row">
                <input
                  className="field-input tag-add-input"
                  placeholder="Add breed…"
                  value={breedInput}
                  onChange={e => setBreedInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag('breed', breedInput); setBreedInput(''); } }}
                />
                <button type="button" className="tag-add-btn" onClick={() => { addCustomTag('breed', breedInput); setBreedInput(''); }}>Add</button>
              </div>
              <div className="tag-add-row">
                <input
                  className="field-input tag-add-input"
                  placeholder="Add colour…"
                  value={colorInput}
                  onChange={e => setColorInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomTag('color', colorInput); setColorInput(''); } }}
                />
                <button type="button" className="tag-add-btn" onClick={() => { addCustomTag('color', colorInput); setColorInput(''); }}>Add</button>
              </div>
            </div>
            <TextField label="Age (years)" id="ageYears" type="number" min="0" max="30" placeholder="e.g. 3" value={form.ageYears} onChange={set('ageYears')} />
            <TextArea label="Description" id="description" placeholder="Describe markings, collar, personality…" value={form.description} onChange={set('description')} />
            <TextField
              label="Microchip ID (optional)"
              id="microchipId"
              placeholder="985141002345678"
              value={form.microchipId}
              onChange={set('microchipId')}
              hint="15-digit ISO chip number if available"
            />
            {!isFound && (
              <TextField
                label="Reward (optional)"
                id="reward"
                placeholder="e.g. ₹5,000"
                value={form.reward}
                onChange={set('reward')}
                hint="Offering a reward can help — shown on the pet page and poster"
              />
            )}
            <div className="step-nav">
              <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
              <Button variant="primary" onClick={nextStep}>Continue →</Button>
            </div>
          </div>
        )}

        {/* Step 3: Location */}
        {step === 3 && (
          <div className="step-content">
            <div className="location-info-box">
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--sprout-600)" strokeWidth="2.3" width="20" height="20" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <p className="t-body-m" style={{ color: 'var(--bark-700)' }}>
                {isFound
                  ? <>Where did you find <strong>{form.name || 'this pet'}</strong>?</>
                  : <>Where did you last see <strong>{form.name || 'your pet'}</strong>?</>}
              </p>
            </div>

            <button
              type="button"
              className={`use-location-btn ${locStatus === 'done' ? 'use-location-done' : ''}`}
              onClick={captureLocation}
              disabled={locStatus === 'loading'}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="18" height="18" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {locStatus === 'loading' ? 'Locating…' : locStatus === 'done' ? 'Location pinned' : 'Use my current location'}
            </button>
            {locMessage && (
              <p className={`loc-status t-body-s ${locStatus === 'error' ? 'loc-status-error' : ''}`} role="status">
                {locMessage}
              </p>
            )}

            <div className="field-group">
              <span className="field-label t-label">Pin the spot</span>
              <LocationPicker value={pickedLocation} onChange={onPickLocation} height="240px" />
            </div>

            <TextField
              label="Location name"
              id="locationLabel"
              placeholder="e.g. Koramangala 5th Block"
              value={form.locationLabel}
              onChange={set('locationLabel')}
              required
              error={errors.locationLabel}
            />

            <div className="report-summary">
              <p className="t-body-s" style={{ color: 'var(--bark-500)', marginBottom: 8 }}>Reporting:</p>
              <div className="summary-row">
                <span className="t-title">{form.name}</span>
                <span className="t-body-m" style={{ color: 'var(--bark-500)' }}>
                  {form.species === 'dog' ? '🐶' : form.species === 'cat' ? '🐱' : '🐾'} {form.breed || form.species}
                </span>
              </div>
            </div>

            <div className="step-nav">
              <Button variant="secondary" onClick={() => setStep(2)}>← Back</Button>
              <Button variant={(isEdit || isFound) ? 'primary' : 'lost'} onClick={submit} disabled={submitting}>
                {submitting
                  ? (isEdit ? 'Saving…' : 'Reporting…')
                  : isEdit ? 'Save changes'
                  : isFound ? `Report ${form.name || 'this pet'} as found`
                  : `Report ${form.name || 'pet'} as lost`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

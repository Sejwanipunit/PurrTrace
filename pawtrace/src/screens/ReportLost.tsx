import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import { Button } from '../components/Button';
import { PawIcon } from '../components/PawPath';
import { uploadPhoto } from '../data/petsService';
import type { NewPet, Species } from '../types';
import './ReportLost.css';

interface FormData {
  name: string;
  species: Species | '';
  breed: string;
  ageYears: string;
  description: string;
  microchipId: string;
  photoUrl: string;
  locationLabel: string;
  locationLat: string;
  locationLng: string;
}

interface Errors {
  [k: string]: string;
}

const INITIAL: FormData = {
  name: '', species: '', breed: '', ageYears: '', description: '',
  microchipId: '', photoUrl: '', locationLabel: '', locationLat: '', locationLng: '',
};

function validateStep1(f: FormData): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = 'Name is required.';
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

export function ReportLost() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addPet, showToast, currentUser } = useAppStore();
  const navigate = useNavigate();

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setForm(prev => ({ ...prev, photoUrl: URL.createObjectURL(file) }));
  };

  const set = (k: keyof FormData) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [k]: e.target.value }));
    if (errors[k]) setErrors(prev => { const n = { ...prev }; delete n[k]; return n; });
  };

  const nextStep = () => {
    if (step === 1) {
      const e = validateStep1(form);
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

      const input: NewPet = {
        name: form.name.trim(),
        species: form.species as Species,
        breed: form.breed.trim() || undefined,
        ageYears: form.ageYears ? Number(form.ageYears) : undefined,
        status: 'lost',
        photoUrl,
        description: form.description.trim() || undefined,
        microchipId: form.microchipId.trim() || undefined,
        lastSeen: {
          lat: Number(form.locationLat) || 12.9716,
          lng: Number(form.locationLng) || 77.5946,
          label: form.locationLabel.trim(),
          at: new Date().toISOString(),
        },
        reportedById: currentUser.id,
        reportedByName: currentUser.name,
      };
      const created = await addPet(input);
      showToast(`${created.name} has been reported as lost`);
      navigate(`/pet/${created.id}`);
    } catch {
      setErrors({ locationLabel: 'We couldn’t save that report — please try again.' });
      setSubmitting(false);
    }
  };

  return (
    <div className="report-lost screen-content">
      <header className="report-header">
        <button className="back-btn" onClick={() => step > 1 ? setStep(s => s - 1) : navigate(-1)} aria-label="Go back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" width="22" height="22">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div>
          <h1 className="t-headline">Report a lost pet</h1>
          <p className="t-body-s" style={{ color: 'var(--bark-500)' }}>Help us help you find them</p>
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
              label="Pet's name"
              id="name"
              placeholder="e.g. Bruno"
              value={form.name}
              onChange={set('name')}
              required
              error={errors.name}
            />

            <Button variant="primary" fullWidth onClick={nextStep}>Continue →</Button>
          </div>
        )}

        {/* Step 2: Details */}
        {step === 2 && (
          <div className="step-content">
            <TextField label="Breed (optional)" id="breed" placeholder="e.g. Labrador" value={form.breed} onChange={set('breed')} />
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
                Where did you last see <strong>{form.name || 'your pet'}</strong>?
              </p>
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
            <TextField
              label="Latitude (optional)"
              id="locationLat"
              type="number"
              step="0.00001"
              placeholder="12.9716"
              value={form.locationLat}
              onChange={set('locationLat')}
            />
            <TextField
              label="Longitude (optional)"
              id="locationLng"
              type="number"
              step="0.00001"
              placeholder="77.5946"
              value={form.locationLng}
              onChange={set('locationLng')}
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
              <Button variant="lost" onClick={submit} disabled={submitting}>
                {submitting ? 'Reporting…' : `Report ${form.name || 'pet'} as lost`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

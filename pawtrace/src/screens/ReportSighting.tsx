import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import { Button } from '../components/Button';
import { LocationPicker } from '../components/LocationPicker';
import { uploadPhoto } from '../data/petsService';
import { getCurrentLocation, reverseGeocode, type Coords } from '../lib/geolocation';
import type { NewSighting } from '../types';
import './ReportSighting.css';

function TextField({ label, id, error, ...props }: { label: string; id: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field-group">
      <label className="field-label t-label" htmlFor={id}>{label}</label>
      <input id={id} className={`field-input ${error ? 'field-input-error' : ''}`} {...props} />
      {error && <p className="field-error t-body-s" role="alert">{error}</p>}
    </div>
  );
}

export function ReportSighting() {
  const { id: petId } = useParams<{ id: string }>();
  const { pets, addSighting, showToast, currentUser } = useAppStore();
  const navigate = useNavigate();

  const pet = pets.find(p => p.id === petId);

  const [form, setForm] = useState({ note: '', photoUrl: '', locationLabel: '', lat: '', lng: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [locMessage, setLocMessage] = useState('');

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm(prev => ({ ...prev, [k]: e.target.value }));
    if (errors[k]) setErrors(prev => { const n = { ...prev }; delete n[k]; return n; });
  };

  // Capture the device's location and fill lat/lng + a friendly place label.
  const captureLocation = useCallback(async () => {
    setLocStatus('loading');
    setLocMessage('Getting your location…');
    try {
      const { lat, lng } = await getCurrentLocation();
      setForm(prev => ({ ...prev, lat: lat.toFixed(5), lng: lng.toFixed(5) }));
      const label = await reverseGeocode(lat, lng);
      setForm(prev => ({ ...prev, locationLabel: prev.locationLabel || label || prev.locationLabel }));
      setLocStatus('done');
      setLocMessage(label ? `Using your location · ${label}` : 'Using your current location');
    } catch (err) {
      setLocStatus('error');
      setLocMessage(err instanceof Error ? err.message : 'Couldn’t get your location.');
    }
  }, []);

  // Try to grab location automatically when the screen opens (prompts for permission).
  useEffect(() => {
    captureLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Picked spot shown on the mini map; coordinates live in the form state.
  const pickedLocation: Coords | null =
    form.lat && form.lng ? { lat: Number(form.lat), lng: Number(form.lng) } : null;

  const onPickLocation = async ({ lat, lng }: Coords) => {
    setForm(prev => ({ ...prev, lat: lat.toFixed(5), lng: lng.toFixed(5) }));
    setLocStatus('done');
    setLocMessage('Location pinned');
    const label = await reverseGeocode(lat, lng);
    if (label) {
      setForm(prev => ({ ...prev, locationLabel: prev.locationLabel || label }));
      setLocMessage(`Pinned · ${label}`);
    }
  };

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

  const submit = async () => {
    const e: Record<string, string> = {};
    if (!form.note.trim() && !form.locationLabel.trim()) {
      e.note = 'Please add a note or location.';
    }
    if (Object.keys(e).length) { setErrors(e); return; }
    if (!petId) { navigate('/'); return; }

    setSubmitting(true);
    try {
      let photoUrl = form.photoUrl.trim() && !form.photoUrl.startsWith('blob:') ? form.photoUrl.trim() : undefined;
      if (photoFile) {
        photoUrl = await uploadPhoto(photoFile, currentUser.id);
      }
      // The sighting record has no separate place field, so fold the location
      // label into the note — otherwise "Where did you see them?" is silently lost.
      const note = form.note.trim();
      const place = form.locationLabel.trim();
      const fullNote = [note, place && !note.toLowerCase().includes(place.toLowerCase()) ? `📍 ${place}` : '']
        .filter(Boolean)
        .join(' ') || undefined;

      const input: NewSighting = {
        petId,
        lat: Number(form.lat) || pet?.lastSeen.lat || 12.9716,
        lng: Number(form.lng) || pet?.lastSeen.lng || 77.5946,
        note: fullNote,
        photoUrl,
        reportedById: currentUser.id,
        reportedByName: currentUser.name,
      };
      await addSighting(input);
      showToast('Sighting reported — thank you!');
      navigate(`/pet/${petId}`);
    } catch {
      setErrors({ note: 'We couldn’t save that sighting — please try again.' });
      setSubmitting(false);
    }
  };

  return (
    <div className="report-sighting screen-content">
      <header className="report-header">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" width="22" height="22">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div>
          <h1 className="t-headline">Report a sighting</h1>
          {pet && <p className="t-body-s" style={{ color: 'var(--bark-500)' }}>I saw {pet.name}</p>}
        </div>
      </header>

      <div className="sighting-body">
        {pet && (
          <div className="sighting-pet-row">
            {pet.photoUrl && <img src={pet.photoUrl} alt={pet.name} className="sighting-pet-photo" />}
            <div>
              <p className="t-title">{pet.name}</p>
              {pet.breed && <p className="t-body-s" style={{ color: 'var(--bark-500)' }}>{pet.breed}</p>}
            </div>
          </div>
        )}

        {!pet && (
          <div className="sighting-general">
            <svg viewBox="0 0 24 24" fill="var(--sprout-300)" width="40" height="40">
              <ellipse cx="12" cy="16" rx="6" ry="5"/>
              <circle cx="5" cy="9" r="2.4"/>
              <circle cx="19" cy="9" r="2.4"/>
              <circle cx="9" cy="5" r="2.2"/>
              <circle cx="15" cy="5" r="2.2"/>
            </svg>
            <div>
              <p className="t-title">General sighting</p>
              <p className="t-body-s" style={{ color: 'var(--bark-500)' }}>Saw a stray or unidentified pet?</p>
            </div>
          </div>
        )}

        <div className="field-group">
          <label className="field-label t-label" htmlFor="note">What did you see?</label>
          <textarea
            id="note"
            className={`field-input field-textarea ${errors.note ? 'field-input-error' : ''}`}
            placeholder="Describe what you saw — direction, behavior, any markings…"
            value={form.note}
            onChange={set('note')}
            rows={4}
            aria-describedby={errors.note ? 'note-err' : undefined}
          />
          {errors.note && <p className="field-error t-body-s" id="note-err" role="alert">{errors.note}</p>}
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
          {locStatus === 'loading' ? 'Locating…' : locStatus === 'done' ? 'Location captured' : 'Use my current location'}
        </button>
        {locMessage && (
          <p className={`loc-status t-body-s ${locStatus === 'error' ? 'loc-status-error' : ''}`} role="status">
            {locMessage}
          </p>
        )}

        <div className="field-group">
          <span className="field-label t-label">Pin the spot</span>
          <LocationPicker
            value={pickedLocation}
            onChange={onPickLocation}
            defaultCenter={pet ? { lat: pet.lastSeen.lat, lng: pet.lastSeen.lng } : undefined}
            height="220px"
          />
        </div>

        <TextField
          label="Where did you see them? (optional)"
          id="locationLabel"
          placeholder="e.g. Near the park gate"
          value={form.locationLabel}
          onChange={set('locationLabel') as any}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onPickFile}
          style={{ display: 'none' }}
          aria-hidden="true"
          tabIndex={-1}
        />
        {form.photoUrl ? (
          <div className="field-group">
            <span className="field-label t-label">Photo</span>
            <div className="sighting-photo-preview">
              <img src={form.photoUrl} alt="Sighting preview" />
              <button
                type="button"
                className="sighting-photo-remove"
                onClick={() => { setForm(p => ({ ...p, photoUrl: '' })); setPhotoFile(null); }}
                aria-label="Remove photo"
              >×</button>
            </div>
          </div>
        ) : (
          <button type="button" className="sighting-photo-add" onClick={() => fileInputRef.current?.click()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="20" height="20" aria-hidden="true">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
              <circle cx="12" cy="13" r="3.5"/>
            </svg>
            Add a photo (optional)
          </button>
        )}

        <Button variant="primary" fullWidth onClick={submit} disabled={submitting}>
          {submitting ? 'Submitting…' : 'Report sighting'}
        </Button>
      </div>
    </div>
  );
}

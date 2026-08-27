import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { JourneyTracker } from '../components/JourneyTracker';
import { PetMap } from '../components/PetMap';
import { PawPath } from '../components/PawPath';
import { timeAgo, formatDate } from '../lib/time';
import { generatePoster, sharePosterBlob, downloadPosterBlob, canSharePoster } from '../lib/poster';
import { findPossibleMatches, candidatesFor, type PetMatch } from '../lib/petAI';
import './PetDetail.css';

// Map a colour name to a CSS swatch colour for the attribute chip.
const COLOR_SWATCH: Record<string, string> = {
  black: '#2A271F', white: '#F3F0E7', grey: '#9A9384', gray: '#9A9384',
  brown: '#7A4E2C', tan: '#C8A06E', golden: '#D4AF5A', cream: '#EBDCB4',
  ginger: '#C86E32', orange: '#DC8228',
};
function swatchFor(color: string): string {
  const key = color.toLowerCase().split(/[\s&,]/)[0];
  return COLOR_SWATCH[key] || 'var(--bark-300)';
}
const SPECIES_EMOJI: Record<string, string> = { dog: '🐶', cat: '🐱', other: '🐾' };

export function PetDetail() {
  const { id } = useParams<{ id: string }>();
  const { pets, loading, markReunited, deletePet, showToast, currentUser } = useAppStore();
  const navigate = useNavigate();
  const [showContact, setShowContact] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [posterBlob, setPosterBlob] = useState<Blob | null>(null);
  const [matchStatus, setMatchStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [matches, setMatches] = useState<PetMatch[]>([]);

  const pet = pets.find(p => p.id === id);

  if (loading) {
    return (
      <div className="pet-detail screen-content">
        <div className="detail-loading">
          <div className="detail-hero-skeleton" />
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="skeleton-text" style={{ width: '60%', height: 28 }} />
            <div className="skeleton-text" style={{ width: '40%' }} />
            <div className="skeleton-text" />
            <div className="skeleton-text" />
          </div>
        </div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="pet-detail screen-content">
        <div className="detail-error">
          <button className="back-btn" onClick={() => navigate(-1)} aria-label="Go back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" width="22" height="22">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <p className="t-title" style={{ color: 'var(--bark-700)' }}>Pet not found</p>
            <p className="t-body-m" style={{ color: 'var(--bark-500)', marginTop: 8 }}>
              We couldn't find this pet. It may have been removed.
            </p>
            <div style={{ marginTop: 24 }}>
              <Button onClick={() => navigate('/')}>Back to home</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isOwner = pet.reportedById === currentUser.id;

  const handleReunited = async () => {
    await markReunited(pet.id);
    showToast('Reunited 🎉');
  };

  // Build the poster and open the preview modal.
  const handleShare = async () => {
    setSharing(true);
    try {
      const blob = await generatePoster(pet);
      setPosterBlob(blob);
      setPosterUrl(URL.createObjectURL(blob));
    } catch {
      showToast('Couldn’t create the poster — please try again.');
    } finally {
      setSharing(false);
    }
  };

  const closePoster = () => {
    if (posterUrl) URL.revokeObjectURL(posterUrl);
    setPosterUrl(null);
    setPosterBlob(null);
  };

  const handlePosterShare = async () => {
    if (!posterBlob) return;
    const outcome = await sharePosterBlob(pet, posterBlob);
    if (outcome === 'shared') { showToast('Thanks for spreading the word! 🐾'); closePoster(); }
    if (outcome === 'downloaded') { showToast('Poster saved — share it anywhere!'); closePoster(); }
  };

  const handlePosterDownload = () => {
    if (!posterBlob) return;
    downloadPosterBlob(pet, posterBlob);
    showToast('Poster saved — share it anywhere!');
    closePoster();
  };

  const matchCandidates = candidatesFor(pet, pets);
  const runMatch = async () => {
    if (!pet.photoUrl) return;
    setMatchStatus('loading');
    try {
      const result = await findPossibleMatches(
        { imageUrl: pet.photoUrl, name: pet.name, species: pet.species, breed: pet.breed },
        matchCandidates.map(c => ({ id: c.id, imageUrl: c.photoUrl!, name: c.name, species: c.species, breed: c.breed }))
      );
      setMatches(result);
      setMatchStatus('done');
    } catch {
      setMatchStatus('error');
    }
  };
  const matchSideLabel = pet.status === 'found' ? 'lost' : 'found';

  const handleDelete = async () => {
    if (!window.confirm(`Delete ${pet.name}'s report? This also removes all sightings and can't be undone.`)) return;
    try {
      await deletePet(pet.id);
      showToast('Report deleted');
      navigate('/', { replace: true });
    } catch {
      showToast('Couldn’t delete the report — please try again.');
    }
  };

  return (
    <div className="pet-detail screen-content">
      {/* Hero */}
      <div className="detail-hero">
        {pet.photoUrl
          ? <img src={pet.photoUrl} alt={pet.name} className="detail-hero-img" />
          : <div className="detail-hero-img detail-hero-placeholder" style={{ background: 'var(--sand)' }} />
        }
        <button className="back-btn detail-back" onClick={() => navigate(-1)} aria-label="Go back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" width="22" height="22">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div className="detail-hero-badge">
          <Badge status={pet.status} />
        </div>
      </div>

      <div className="detail-body">
        {/* Name & breed */}
        <div className="detail-title-row">
          <div>
            <h1 className="t-headline">{pet.name}</h1>
            <div className="attr-chips">
              <span className="attr-chip">{SPECIES_EMOJI[pet.species]} {pet.species === 'other' ? 'Pet' : pet.species[0].toUpperCase() + pet.species.slice(1)}</span>
              {pet.breed && <span className="attr-chip">{pet.breed}</span>}
              {pet.color && (
                <span className="attr-chip">
                  <span className="attr-swatch" style={{ background: swatchFor(pet.color) }} aria-hidden="true" />
                  <span style={{ textTransform: 'capitalize' }}>{pet.color}</span>
                </span>
              )}
              {pet.ageYears != null && <span className="attr-chip">{pet.ageYears} yr{pet.ageYears !== 1 ? 's' : ''}</span>}
            </div>
          </div>
          {pet.status !== 'reunited' && isOwner && (
            <Button variant="secondary" onClick={handleReunited} aria-label="Mark as reunited">
              Mark reunited
            </Button>
          )}
        </div>

        {/* Owner tools */}
        {isOwner && (
          <div className="owner-tools">
            <button className="owner-tool-btn" onClick={() => navigate(`/edit/${pet.id}`)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="16" height="16" aria-hidden="true">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>
              </svg>
              Edit report
            </button>
            <button className="owner-tool-btn owner-tool-danger" onClick={handleDelete}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="16" height="16" aria-hidden="true">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Delete
            </button>
          </div>
        )}

        {pet.reward && pet.status !== 'reunited' && (
          <div className="reward-banner" role="note">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="22" height="22" aria-hidden="true">
              <circle cx="12" cy="8" r="6"/>
              <path d="M15.5 13.5 17 22l-5-3-5 3 1.5-8.5"/>
            </svg>
            <div>
              <span className="reward-label t-body-s">Reward offered</span>
              <span className="reward-amount t-title">{pet.reward}</span>
            </div>
          </div>
        )}

        <PawPath count={5} />

        {/* Journey tracker */}
        <section aria-labelledby="journey-label">
          <h2 className="t-title section-label" id="journey-label">Journey</h2>
          <JourneyTracker status={pet.status} createdAt={pet.createdAt} sightingCount={pet.sightings.length} />
        </section>

        {/* AI possible matches — only for active reports with a photo and candidates to compare */}
        {pet.status !== 'reunited' && pet.photoUrl && matchCandidates.length > 0 && (
          <section aria-labelledby="match-label" className="match-section">
            <h2 className="t-title section-label" id="match-label">
              <span className="ai-spark" aria-hidden="true">✨</span> AI possible matches
            </h2>

            {matchStatus === 'idle' && (
              <div className="match-cta-box">
                <p className="t-body-m" style={{ color: 'var(--bark-700)' }}>
                  Compare {pet.name}’s photo against {matchCandidates.length} nearby {matchSideLabel} {matchCandidates.length === 1 ? 'pet' : 'pets'} using AI vision.
                </p>
                <Button variant="secondary" fullWidth onClick={runMatch}>Find possible matches</Button>
              </div>
            )}

            {matchStatus === 'loading' && (
              <div className="match-cta-box">
                <div className="match-spinner" aria-hidden="true" />
                <p className="t-body-m" style={{ color: 'var(--bark-500)' }}>Comparing photos with AI…</p>
              </div>
            )}

            {matchStatus === 'error' && (
              <div className="match-cta-box">
                <p className="t-body-m" style={{ color: 'var(--coral-700)' }}>Couldn’t run matching just now.</p>
                <Button variant="secondary" fullWidth onClick={runMatch}>Try again</Button>
              </div>
            )}

            {matchStatus === 'done' && matches.length === 0 && (
              <div className="match-cta-box">
                <p className="t-body-m" style={{ color: 'var(--bark-500)' }}>
                  No strong matches among nearby {matchSideLabel} pets — that can change as new reports come in.
                </p>
              </div>
            )}

            {matchStatus === 'done' && matches.map(m => {
              const cand = pets.find(p => p.id === m.id);
              if (!cand) return null;
              const level = m.confidence >= 70 ? 'high' : m.confidence >= 50 ? 'mid' : 'low';
              return (
                <button key={m.id} className="match-card" onClick={() => navigate(`/pet/${cand.id}`)}>
                  {cand.photoUrl && <img src={cand.photoUrl} alt={cand.name} className="match-thumb" />}
                  <div className="match-body">
                    <div className="match-head">
                      <span className="t-body-l" style={{ fontWeight: 800 }}>{cand.name}</span>
                      <span className={`match-badge match-${level}`}>{Math.round(m.confidence)}% match</span>
                    </div>
                    <div className="match-bar"><span className={`match-bar-fill match-${level}`} style={{ width: `${Math.min(100, Math.max(6, m.confidence))}%` }} /></div>
                    <p className="t-body-s" style={{ color: 'var(--bark-700)' }}>{m.reasoning}</p>
                  </div>
                </button>
              );
            })}
            <p className="t-body-s match-disclaimer">AI suggestions — always confirm in person before reuniting.</p>
          </section>
        )}

        {/* Description */}
        {pet.description && (
          <section aria-labelledby="desc-label">
            <h2 className="t-title section-label" id="desc-label">About {pet.name}</h2>
            <p className="t-body-l detail-desc">{pet.description}</p>
          </section>
        )}

        {/* Details */}
        <section className="detail-meta-section" aria-labelledby="details-label">
          <h2 className="t-title section-label" id="details-label">Details</h2>
          <div className="detail-meta-grid">
            <div className="meta-item">
              <span className="t-body-s" style={{ color: 'var(--bark-500)' }}>Last seen</span>
              <span className="t-body-m" style={{ fontWeight: 700 }}>{pet.lastSeen.label}</span>
              <span className="t-body-s" style={{ color: 'var(--bark-500)' }}>{timeAgo(pet.lastSeen.at)} · {formatDate(pet.lastSeen.at)}</span>
            </div>
            {pet.microchipId && (
              <div className="meta-item">
                <span className="t-body-s" style={{ color: 'var(--bark-500)' }}>Microchip ID</span>
                <span className="t-mono" style={{ color: 'var(--bark-900)' }}>{pet.microchipId}</span>
              </div>
            )}
            <div className="meta-item">
              <span className="t-body-s" style={{ color: 'var(--bark-500)' }}>Reported by</span>
              <span className="t-body-m" style={{ fontWeight: 700 }}>{pet.reportedBy}</span>
            </div>
          </div>
        </section>

        {/* Mini map */}
        <section aria-labelledby="map-label">
          <h2 className="t-title section-label" id="map-label">
            {pet.sightings.length > 0 ? 'Last seen & sightings' : 'Last seen location'}
          </h2>
          <div className="detail-map-wrap">
            <PetMap
              pets={[pet]}
              showSightings
              center={pet.sightings.length > 0 ? undefined : [pet.lastSeen.lat, pet.lastSeen.lng]}
              zoom={15}
              height="180px"
            />
            <div className="detail-coords t-mono">
              {pet.lastSeen.lat.toFixed(5)}, {pet.lastSeen.lng.toFixed(5)}
            </div>
          </div>
        </section>

        {/* Sightings */}
        {pet.sightings.length > 0 && (
          <section aria-labelledby="sightings-label">
            <h2 className="t-title section-label" id="sightings-label">Sightings ({pet.sightings.length})</h2>
            <div className="sightings-list">
              {pet.sightings.map(s => (
                <div key={s.id} className="sighting-item">
                  <div className="sighting-dot" />
                  <div>
                    <p className="t-body-m" style={{ fontWeight: 700 }}>{s.reportedBy}</p>
                    {s.note && <p className="t-body-s" style={{ color: 'var(--bark-700)' }}>{s.note}</p>}
                    {s.photoUrl && <img src={s.photoUrl} alt={`Sighting of ${pet.name}`} className="sighting-photo" loading="lazy" />}
                    <p className="t-mono" style={{ color: 'var(--bark-500)', marginTop: 2 }}>{timeAgo(s.at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Contact */}
        <section>
          {!showContact ? (
            <button className="contact-reveal" onClick={() => setShowContact(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" width="18" height="18" aria-hidden="true">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6 6l.96-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.7 16z"/>
              </svg>
              Contact the owner
            </button>
          ) : (
            <div className="contact-revealed">
              <p className="t-body-m" style={{ color: 'var(--bark-500)' }}>Reported by</p>
              <p className="t-title contact-number">{pet.reportedBy}</p>
              <p className="t-body-s" style={{ color: 'var(--bark-500)' }}>
                {pet.status === 'reunited'
                  ? `${pet.name} is already back home — no action needed.`
                  : `Report a sighting below and ${pet.reportedBy} is notified instantly.`}
              </p>
            </div>
          )}
        </section>

        {/* CTAs */}
        {pet.status !== 'reunited' && (
          <div className="detail-ctas">
            <Button variant="primary" fullWidth onClick={() => navigate(`/report-sighting/${pet.id}`)}>
              I've seen {pet.name}
            </Button>
            <button className="t-body-m sighting-link" onClick={() => navigate(`/report-sighting/${pet.id}`)}>
              Report a sighting →
            </button>
          </div>
        )}

        {/* Share poster */}
        <Button variant="secondary" fullWidth onClick={handleShare} disabled={sharing}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="17" height="17" aria-hidden="true" style={{ marginRight: 8, verticalAlign: '-3px' }}>
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/>
          </svg>
          {sharing ? 'Preparing poster…' : `See ${pet.name}’s poster`}
        </Button>

        {pet.status === 'reunited' && (
          <div className="reunited-banner">
            <span style={{ fontSize: 32 }}>🎉</span>
            <div>
              <p className="t-title" style={{ color: 'var(--lagoon-700)' }}>{pet.name} is home!</p>
              <p className="t-body-m" style={{ color: 'var(--lagoon-700)', opacity: 0.8 }}>
                Thanks to everyone who helped.
              </p>
            </div>
          </div>
        )}
      </div>

      {posterUrl && (
        <div className="poster-modal" role="dialog" aria-modal="true" aria-label={`${pet.name}'s poster`} onClick={closePoster}>
          <div className="poster-modal-card" onClick={e => e.stopPropagation()}>
            <button className="poster-close" onClick={closePoster} aria-label="Close preview">×</button>
            <img src={posterUrl} alt={`Shareable poster for ${pet.name}`} className="poster-preview-img" />
            <div className="poster-modal-actions">
              {canSharePoster() && (
                <Button variant="primary" fullWidth onClick={handlePosterShare}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="17" height="17" aria-hidden="true" style={{ marginRight: 8, verticalAlign: '-3px' }}>
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.6" y1="10.5" x2="15.4" y2="6.5"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/>
                  </svg>
                  Share
                </Button>
              )}
              <Button variant="secondary" fullWidth onClick={handlePosterDownload}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" width="17" height="17" aria-hidden="true" style={{ marginRight: 8, verticalAlign: '-3px' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Download
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { JourneyTracker } from '../components/JourneyTracker';
import { PetMap } from '../components/PetMap';
import { PawPath } from '../components/PawPath';
import type { Pet } from '../types';
import { timeAgo, formatDate } from '../lib/time';
import './PetDetail.css';

export function PetDetail() {
  const { id } = useParams<{ id: string }>();
  const { pets, loading, error, markReunited, showToast, currentUser } = useAppStore();
  const navigate = useNavigate();
  const [showContact, setShowContact] = useState(false);

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

  if (!pet || error) {
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

  const handleReunited = async () => {
    await markReunited(pet.id);
    showToast('Reunited 🎉');
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
            {pet.breed && <p className="t-body-m" style={{ color: 'var(--bark-500)' }}>
              {pet.breed}{pet.ageYears ? `, ${pet.ageYears} year${pet.ageYears !== 1 ? 's' : ''} old` : ''}
            </p>}
          </div>
          {pet.status !== 'reunited' && pet.reportedById === currentUser.id && (
            <Button variant="secondary" onClick={handleReunited} aria-label="Mark as reunited">
              Mark reunited
            </Button>
          )}
        </div>

        <PawPath count={5} />

        {/* Journey tracker */}
        <section aria-labelledby="journey-label">
          <h2 className="t-title section-label" id="journey-label">Journey</h2>
          <JourneyTracker status={pet.status} createdAt={pet.createdAt} sightingCount={pet.sightings.length} />
        </section>

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
          <h2 className="t-title section-label" id="map-label">Last seen location</h2>
          <div className="detail-map-wrap">
            <PetMap
              pets={[pet]}
              center={[pet.lastSeen.lat, pet.lastSeen.lng]}
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
              Show owner contact
            </button>
          ) : (
            <div className="contact-revealed">
              <p className="t-body-m" style={{ color: 'var(--bark-500)' }}>Contact owner</p>
              <a href="tel:+919876543210" className="t-title contact-number">+91 98765 43210</a>
              <p className="t-body-s" style={{ color: 'var(--bark-500)' }}>Reported by {pet.reportedBy}</p>
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
    </div>
  );
}

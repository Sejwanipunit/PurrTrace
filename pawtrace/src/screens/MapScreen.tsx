import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import { PetMap } from '../components/PetMap';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import type { Pet } from '../types';
import { timeAgo } from '../lib/time';
import './MapScreen.css';

export function MapScreen() {
  const { pets, loading } = useAppStore();
  const [selectedPet, setSelectedPet] = useState<Pet | null>(null);
  const navigate = useNavigate();

  const activePets = pets.filter(p => p.status !== 'reunited');

  return (
    <div className="map-screen">
      <div className="map-header">
        <h1 className="t-headline">Nearby Pets</h1>
        <span className="t-body-s" style={{ color: 'var(--bark-500)' }}>
          {activePets.length} active reports
        </span>
      </div>

      {loading ? (
        <div className="map-loading">
          <div className="map-skeleton" />
          <p className="t-body-m" style={{ color: 'var(--bark-500)', padding: '16px', textAlign: 'center' }}>Loading map…</p>
        </div>
      ) : (
        <PetMap
          pets={activePets}
          center={[12.9716, 77.5946]}
          zoom={14}
          height="calc(100vh - 160px)"
          onPinClick={setSelectedPet}
          highlightId={selectedPet?.id}
        />
      )}

      {/* Legend */}
      <div className="map-legend">
        <span className="legend-item"><span className="legend-dot" style={{ background: '#F2603C' }} />Lost</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: '#6FB833' }} />Found</span>
        <span className="legend-item"><span className="legend-dot" style={{ background: '#F5D827' }} />Searching</span>
      </div>

      {/* Bottom sheet */}
      {selectedPet && (
        <>
          <div className="sheet-backdrop" onClick={() => setSelectedPet(null)} aria-hidden="true" />
          <div className="bottom-sheet" role="dialog" aria-label={`Details for ${selectedPet.name}`}>
            <div className="sheet-handle" />
            <div className="sheet-content">
              <div className="sheet-pet-row">
                {selectedPet.photoUrl
                  ? <img src={selectedPet.photoUrl} alt={selectedPet.name} className="sheet-photo" />
                  : <div className="sheet-photo sheet-photo-placeholder" />
                }
                <div className="sheet-pet-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span className="t-title">{selectedPet.name}</span>
                    <Badge status={selectedPet.status} />
                  </div>
                  {selectedPet.breed && <p className="t-body-s" style={{ color: 'var(--bark-500)' }}>{selectedPet.breed}</p>}
                  <p className="t-body-m" style={{ color: 'var(--bark-700)' }}>
                    {selectedPet.lastSeen.label} · {timeAgo(selectedPet.lastSeen.at)}
                  </p>
                </div>
              </div>

              {selectedPet.description && (
                <p className="t-body-m sheet-desc">{selectedPet.description}</p>
              )}

              <div className="sheet-actions">
                <Button variant="secondary" onClick={() => {
                  const { lat, lng } = selectedPet.lastSeen;
                  window.open(`https://maps.google.com/?q=${lat},${lng}`, '_blank', 'noopener');
                }}>
                  Directions
                </Button>
                <Button variant="primary" onClick={() => navigate(`/report-sighting/${selectedPet.id}`)}>
                  I've seen {selectedPet.name}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

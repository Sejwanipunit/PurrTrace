import React from 'react';
import { Link } from 'react-router-dom';
import type { Pet } from '../types';
import { Badge } from './Badge';
import { timeAgo } from '../lib/time';
import { formatDistance } from '../lib/distance';
import './PetCard.css';

interface PetCardProps {
  pet: Pet;
  variant?: 'horizontal' | 'grid';
}

function PetPhoto({ pet, size }: { pet: Pet; size: 'sm' | 'lg' }) {
  if (pet.photoUrl) {
    return <img src={pet.photoUrl} alt={pet.name} className={`pet-photo pet-photo-${size}`} />;
  }
  const color = pet.status === 'lost' ? '#F2603C' : pet.status === 'found' ? '#6FB833' : pet.status === 'searching' ? '#F5D827' : '#3EA094';
  return (
    <div className={`pet-photo pet-photo-${size} pet-photo-placeholder`} style={{ background: `linear-gradient(135deg, ${color}22, ${color}44)` }}>
      <svg viewBox="0 0 24 24" fill={color} width="40%" height="40%">
        <ellipse cx="12" cy="16" rx="6" ry="5"/>
        <circle cx="5" cy="9" r="2.4"/>
        <circle cx="19" cy="9" r="2.4"/>
        <circle cx="9" cy="5" r="2.2"/>
        <circle cx="15" cy="5" r="2.2"/>
      </svg>
    </div>
  );
}

export function PetCard({ pet, variant = 'horizontal' }: PetCardProps) {
  if (variant === 'grid') {
    return (
      <Link to={`/pet/${pet.id}`} className="pet-card-grid">
        <div className="pet-card-grid-photo">
          <PetPhoto pet={pet} size="lg" />
          <div className="pet-card-grid-badge"><Badge status={pet.status} /></div>
          <button className="pet-card-heart" aria-label="Save pet" onClick={e => e.preventDefault()}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </button>
        </div>
        <div className="pet-card-body">
          <div className="pet-card-name t-title">{pet.name}</div>
          {pet.breed && <div className="pet-card-breed t-body-s">{pet.breed}</div>}
          <div className="pet-card-meta t-body-m">
            <span>{timeAgo(pet.lastSeen.at)}</span>
            {pet.distanceKm !== undefined && <span>· {formatDistance(pet.distanceKm)}</span>}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link to={`/pet/${pet.id}`} className="pet-card">
      <PetPhoto pet={pet} size="sm" />
      <div className="pet-card-content">
        <div className="pet-card-header">
          <div className="pet-card-name t-title">{pet.name}</div>
          <Badge status={pet.status} />
        </div>
        {pet.breed && <div className="pet-card-breed t-body-s">{pet.breed}</div>}
        <div className="pet-card-meta t-body-m">
          <span>{pet.lastSeen.label}</span>
          <span>·</span>
          <span>{timeAgo(pet.lastSeen.at)}</span>
          {pet.distanceKm !== undefined && (
            <>
              <span>·</span>
              <span>{formatDistance(pet.distanceKm)}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}

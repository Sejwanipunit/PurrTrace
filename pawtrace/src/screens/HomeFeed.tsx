import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../context/AppStore';
import { PetCard } from '../components/PetCard';
import { Chip } from '../components/Chip';
import { AlertBanner } from '../components/AlertBanner';
import { PawPath } from '../components/PawPath';
import type { Pet } from '../types';
import { isFreshReport } from '../lib/time';
import './HomeFeed.css';

type FilterKey = 'all' | 'dogs' | 'cats' | '5km' | 'today';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'dogs', label: 'Dogs' },
  { key: 'cats', label: 'Cats' },
  { key: '5km', label: 'Within 5km' },
  { key: 'today', label: 'Today' },
];

function applyFilter(pets: Pet[], filter: FilterKey): Pet[] {
  const todayStart = new Date().setHours(0, 0, 0, 0);
  switch (filter) {
    case 'dogs': return pets.filter(p => p.species === 'dog');
    case 'cats': return pets.filter(p => p.species === 'cat');
    // Only pets with a known distance qualify — unknown distance must not pass a distance filter.
    case '5km': return pets.filter(p => p.distanceKm != null && p.distanceKm <= 5);
    case 'today': return pets.filter(p => new Date(p.createdAt).getTime() >= todayStart);
    default: return pets;
  }
}

export function HomeFeed() {
  const { pets, loading, error, currentUser, shareLocation } = useAppStore();
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');
  const navigate = useNavigate();

  // Public feed only shows recent reports; owners still see theirs in Profile.
  const freshPets = useMemo(() => pets.filter(p => isFreshReport(p.createdAt)), [pets]);

  const lostNearby = freshPets.find(p => p.status === 'lost' && (p.distanceKm ?? 99) < 1);

  const filtered = useMemo(() => {
    const result = applyFilter(freshPets, activeFilter);
    // Nearest first once distances are known; otherwise keep newest-first.
    if (result.some(p => p.distanceKm != null)) {
      return [...result].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
    }
    return result;
  }, [freshPets, activeFilter]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="home-feed screen-content">
      {/* Header */}
      <header className="home-header">
        <div className="home-greeting">
          <div>
            <p className="t-body-s" style={{ color: 'var(--bark-500)' }}>{greeting}</p>
            <h1 className="t-headline" style={{ color: 'var(--bark-900)' }}>{currentUser.name} 👋</h1>
          </div>
          <div className="home-avatar" aria-label={`Avatar for ${currentUser.name}`}>
            {currentUser.avatarUrl
              ? <img src={currentUser.avatarUrl} alt={currentUser.name} />
              : <span style={{ fontFamily: 'Fredoka', fontWeight: 600, fontSize: 18 }}>{currentUser.name[0]}</span>
            }
          </div>
        </div>

        {/* Search bar */}
        <div className="home-search" role="search">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--bark-300)" strokeWidth="2.3" width="18" height="18" className="search-icon" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          {/* Acts as a shortcut to the dedicated search screen; typing happens there. */}
          <input
            type="search"
            placeholder="Search by name, breed, or area…"
            readOnly
            onFocus={() => navigate('/search')}
            onClick={() => navigate('/search')}
            className="home-search-input"
            aria-label="Search pets"
          />
        </div>
      </header>

      <div className="home-body">
        {/* Alert banner */}
        {lostNearby && (
          <div className="home-section">
            <AlertBanner
              title={`${lostNearby.name} is nearby`}
              message={`${lostNearby.breed || 'A pet'} was lost ${lostNearby.distanceKm?.toFixed(1)}km away in ${lostNearby.lastSeen.label}. Keep an eye out!`}
            />
          </div>
        )}

        {/* Filter chips */}
        <div className="filter-chips-row" role="listbox" aria-label="Filter pets">
          {FILTERS.map(f => (
            <Chip
              key={f.key}
              label={f.label}
              active={activeFilter === f.key}
              onClick={() => setActiveFilter(f.key)}
            />
          ))}
        </div>

        <PawPath count={5} />

        {/* Pet list */}
        {loading && (
          <div className="home-section">
            {[1, 2, 3].map(i => <div key={i} className="skeleton-card" />)}
          </div>
        )}

        {error && !loading && (
          <div className="home-empty">
            <p className="t-body-l" style={{ color: 'var(--coral-700)' }}>{error}</p>
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="home-empty">
            <svg viewBox="0 0 24 24" fill="var(--sprout-300)" width="56" height="56">
              <ellipse cx="12" cy="16" rx="6" ry="5"/>
              <circle cx="5" cy="9" r="2.4"/>
              <circle cx="19" cy="9" r="2.4"/>
              <circle cx="9" cy="5" r="2.2"/>
              <circle cx="15" cy="5" r="2.2"/>
            </svg>
            <p className="t-title" style={{ color: 'var(--bark-700)' }}>
              {activeFilter === 'all' ? 'No pets reported nearby' : 'No results for this filter'}
            </p>
            <p className="t-body-m" style={{ color: 'var(--bark-500)' }}>
              {activeFilter === 'all'
                ? "That's good news. Be the first to help if something changes."
                : activeFilter === '5km' && !shareLocation
                  ? 'Turn on "Share location" in your Profile to see pets near you.'
                  : 'Try a different filter to see more results.'}
            </p>
          </div>
        )}

        {!loading && !error && (
          <div className="home-section pet-list">
            {filtered.map(pet => (
              <PetCard key={pet.id} pet={pet} variant="horizontal" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

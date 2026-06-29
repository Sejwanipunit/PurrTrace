import React, { useState, useMemo } from 'react';
import { useAppStore } from '../context/AppStore';
import { PetCard } from '../components/PetCard';
import { Chip } from '../components/Chip';
import type { Pet, PetStatus } from '../types';
import './SearchScreen.css';

type FilterKey = 'all' | 'lost' | 'found' | 'searching' | 'reunited' | 'dogs' | 'cats';

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'lost', label: 'Lost' },
  { key: 'found', label: 'Found' },
  { key: 'searching', label: 'Searching' },
  { key: 'reunited', label: 'Reunited' },
  { key: 'dogs', label: 'Dogs' },
  { key: 'cats', label: 'Cats' },
];

export function SearchScreen() {
  const { pets, loading } = useAppStore();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all');

  const results = useMemo(() => {
    let r = pets;
    if (activeFilter !== 'all') {
      if (activeFilter === 'dogs') r = r.filter(p => p.species === 'dog');
      else if (activeFilter === 'cats') r = r.filter(p => p.species === 'cat');
      else r = r.filter(p => p.status === activeFilter);
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.breed?.toLowerCase().includes(q) ||
        p.lastSeen.label.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    }
    return r;
  }, [pets, query, activeFilter]);

  return (
    <div className="search-screen screen-content">
      <header className="search-header">
        <h1 className="t-headline">Search</h1>
        <div className="search-bar" role="search">
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--bark-300)" strokeWidth="2.3" width="18" height="18" aria-hidden="true">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="search"
            placeholder="Name, breed, or area…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="search-input"
            aria-label="Search for pets"
            autoFocus
          />
          {query && (
            <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" width="16" height="16">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>

        <div className="filter-chips-row" role="listbox" aria-label="Filter results">
          {FILTERS.map(f => (
            <Chip key={f.key} label={f.label} active={activeFilter === f.key} onClick={() => setActiveFilter(f.key)} />
          ))}
        </div>
      </header>

      <div className="search-results">
        {loading && (
          <p className="t-body-m search-hint" style={{ color: 'var(--bark-500)' }}>Loading…</p>
        )}

        {!loading && query.trim() === '' && activeFilter === 'all' && (
          <div className="search-hint-block">
            <svg viewBox="0 0 24 24" fill="var(--sprout-200)" width="48" height="48">
              <ellipse cx="12" cy="16" rx="6" ry="5"/>
              <circle cx="5" cy="9" r="2.4"/>
              <circle cx="19" cy="9" r="2.4"/>
              <circle cx="9" cy="5" r="2.2"/>
              <circle cx="15" cy="5" r="2.2"/>
            </svg>
            <p className="t-body-l" style={{ color: 'var(--bark-500)' }}>
              Search for pets by name, breed, or area.
            </p>
          </div>
        )}

        {!loading && (query.trim() !== '' || activeFilter !== 'all') && results.length === 0 && (
          <div className="search-hint-block">
            <svg viewBox="0 0 24 24" fill="var(--bark-200)" width="48" height="48">
              <ellipse cx="12" cy="16" rx="6" ry="5"/>
              <circle cx="5" cy="9" r="2.4"/>
              <circle cx="19" cy="9" r="2.4"/>
              <circle cx="9" cy="5" r="2.2"/>
              <circle cx="15" cy="5" r="2.2"/>
            </svg>
            <p className="t-title" style={{ color: 'var(--bark-700)' }}>No results found</p>
            <p className="t-body-m" style={{ color: 'var(--bark-500)' }}>
              We couldn't find any pets matching "{query}". Try a nearby landmark or different spelling.
            </p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="search-list">
            <p className="t-body-s" style={{ color: 'var(--bark-500)', paddingBottom: 4 }}>
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
            {results.map(pet => (
              <PetCard key={pet.id} pet={pet} variant="horizontal" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

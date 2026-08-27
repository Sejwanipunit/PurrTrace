import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Fab.css';

export function Fab() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const go = (path: string) => { setOpen(false); navigate(path); };

  return (
    <>
      {open && <div className="fab-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />}
      <div className="fab-wrap">
        {open && (
          <div className="fab-actions" role="menu" aria-label="Report a pet">
            <button className="fab-action fab-action-found" onClick={() => go('/report-found')} role="menuitem">
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" aria-hidden="true">
                <ellipse cx="12" cy="16" rx="6" ry="5"/><circle cx="5" cy="9" r="2.4"/><circle cx="19" cy="9" r="2.4"/><circle cx="9" cy="5" r="2.2"/><circle cx="15" cy="5" r="2.2"/>
              </svg>
              I found a pet
            </button>
            <button className="fab-action fab-action-lost" onClick={() => go('/report')} role="menuitem">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" width="18" height="18" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              I lost a pet
            </button>
          </div>
        )}
        <button
          className={`fab ${open ? 'fab-open' : ''}`}
          onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Close' : 'Report a pet'}
          aria-expanded={open}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" width="28" height="28">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
      </div>
    </>
  );
}

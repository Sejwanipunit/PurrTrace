import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Fab.css';

export function Fab() {
  const navigate = useNavigate();
  return (
    <button
      className="fab"
      onClick={() => navigate('/report')}
      aria-label="Report a lost pet"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" width="28" height="28">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </button>
  );
}

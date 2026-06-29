import React from 'react';
import './Chip.css';

interface ChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function Chip({ label, active, onClick }: ChipProps) {
  return (
    <button
      className={`chip ${active ? 'chip-active' : ''}`}
      onClick={onClick}
      role="option"
      aria-selected={active}
    >
      {label}
    </button>
  );
}

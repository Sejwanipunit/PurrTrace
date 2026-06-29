import React from 'react';
import type { PetStatus } from '../types';
import './Badge.css';

const STATUS_LABELS: Record<PetStatus, string> = {
  lost: 'Lost',
  found: 'Found',
  searching: 'Searching',
  reunited: 'Reunited',
};

interface BadgeProps {
  status: PetStatus;
}

export function Badge({ status }: BadgeProps) {
  return (
    <span className={`badge badge-${status}`}>
      <span className="badge-dot" />
      {STATUS_LABELS[status]}
    </span>
  );
}

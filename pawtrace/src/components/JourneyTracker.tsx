import React from 'react';
import type { PetStatus } from '../types';
import './JourneyTracker.css';

interface JourneyTrackerProps {
  status: PetStatus;
  createdAt: string;
  sightingCount: number;
}

type NodeState = 'done' | 'current' | 'future';

function getNodeStates(status: PetStatus): [NodeState, NodeState, NodeState] {
  if (status === 'reunited') return ['done', 'done', 'done'];
  if (status === 'searching' || status === 'found') return ['done', 'current', 'future'];
  return ['done', 'future', 'future']; // lost
}

function NodeIcon({ state }: { state: NodeState }) {
  if (state === 'done') return (
    <svg viewBox="0 0 24 24" fill="var(--sprout-500)" width="24" height="24">
      <ellipse cx="12" cy="16" rx="6" ry="5"/>
      <circle cx="5" cy="9" r="2.4"/>
      <circle cx="19" cy="9" r="2.4"/>
      <circle cx="9" cy="5" r="2.2"/>
      <circle cx="15" cy="5" r="2.2"/>
    </svg>
  );
  if (state === 'current') return (
    <svg viewBox="0 0 24 24" fill="var(--sun-400)" width="24" height="24">
      <ellipse cx="12" cy="16" rx="6" ry="5"/>
      <circle cx="5" cy="9" r="2.4"/>
      <circle cx="19" cy="9" r="2.4"/>
      <circle cx="9" cy="5" r="2.2"/>
      <circle cx="15" cy="5" r="2.2"/>
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="var(--bark-300)" strokeWidth="1.5" width="24" height="24">
      <ellipse cx="12" cy="16" rx="6" ry="5"/>
      <circle cx="5" cy="9" r="2.4"/>
      <circle cx="19" cy="9" r="2.4"/>
      <circle cx="9" cy="5" r="2.2"/>
      <circle cx="15" cy="5" r="2.2"/>
    </svg>
  );
}

function DashedLine({ active }: { active: boolean }) {
  return (
    <div className={`journey-line ${active ? 'journey-line-active' : ''}`} aria-hidden="true" />
  );
}

export function JourneyTracker({ status, sightingCount }: JourneyTrackerProps) {
  const [n1, n2, n3] = getNodeStates(status);
  return (
    <div className="journey-tracker" role="group" aria-label="Pet journey status">
      <div className="journey-nodes">
        <div className={`journey-node journey-node-${n1}`}>
          <NodeIcon state={n1} />
          <span className="journey-label">Reported lost</span>
        </div>
        <DashedLine active={n1 === 'done' && n2 !== 'future'} />
        <div className={`journey-node journey-node-${n2}`}>
          <NodeIcon state={n2} />
          <span className="journey-label">
            Spotted nearby
            {sightingCount > 0 && <span className="journey-count">{sightingCount}</span>}
          </span>
        </div>
        <DashedLine active={n2 === 'done' && n3 !== 'future'} />
        <div className={`journey-node journey-node-${n3}`}>
          <NodeIcon state={n3} />
          <span className="journey-label">Reunited 🎉</span>
        </div>
      </div>
    </div>
  );
}

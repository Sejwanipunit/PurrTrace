import React from 'react';
import './PawPath.css';

interface PawPathProps {
  count?: number;
  direction?: 'horizontal' | 'vertical';
}

function PawSvg({ size = 16, opacity = 0.35 }: { size?: number; opacity?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="var(--sprout-500)" width={size} height={size} style={{ opacity }}>
      <ellipse cx="12" cy="16" rx="6" ry="5"/>
      <circle cx="5" cy="9" r="2.4"/>
      <circle cx="19" cy="9" r="2.4"/>
      <circle cx="9" cy="5" r="2.2"/>
      <circle cx="15" cy="5" r="2.2"/>
    </svg>
  );
}

export function PawPath({ count = 5, direction = 'horizontal' }: PawPathProps) {
  return (
    <div className={`paw-path paw-path-${direction}`} aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <React.Fragment key={i}>
          <PawSvg size={14} opacity={0.25 + (i % 2) * 0.1} />
          {i < count - 1 && <span className="paw-dash" />}
        </React.Fragment>
      ))}
    </div>
  );
}

export function PawIcon({ size = 20, color = 'currentColor', opacity = 1 }: { size?: number; color?: string; opacity?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill={color} width={size} height={size} style={{ opacity }}>
      <ellipse cx="12" cy="16" rx="6" ry="5"/>
      <circle cx="5" cy="9" r="2.4"/>
      <circle cx="19" cy="9" r="2.4"/>
      <circle cx="9" cy="5" r="2.2"/>
      <circle cx="15" cy="5" r="2.2"/>
    </svg>
  );
}

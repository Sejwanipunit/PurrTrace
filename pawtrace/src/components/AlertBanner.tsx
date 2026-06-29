import React from 'react';
import './AlertBanner.css';

interface AlertBannerProps {
  title: string;
  message: string;
}

export function AlertBanner({ title, message }: AlertBannerProps) {
  return (
    <div className="alert-banner" role="alert">
      <div className="alert-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="20" height="20">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </div>
      <div>
        <div className="alert-title t-title">{title}</div>
        <div className="alert-message t-body-s">{message}</div>
      </div>
    </div>
  );
}

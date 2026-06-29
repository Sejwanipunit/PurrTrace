import React from 'react';
import './Button.css';

type Variant = 'primary' | 'lost' | 'secondary' | 'tertiary';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function Button({ variant = 'primary', fullWidth, children, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} ${fullWidth ? 'btn-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

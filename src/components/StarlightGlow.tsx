import React from 'react';

// Starlight Glow backdrop — soft radial lighting layer used across sections.
export function StarlightGlow({ className = '' }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none select-none rounded-full blur-3xl ${className}`}
      aria-hidden="true"
    />
  );
}

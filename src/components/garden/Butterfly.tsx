import React from 'react';

// Single butterfly with veined, iridescent wings.
export default function Butterfly({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 110" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="wingA" cx="30%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#FFD9F0" />
          <stop offset="60%" stopColor="#FFB5E8" />
          <stop offset="100%" stopColor="#C2478F" />
        </radialGradient>
        <radialGradient id="wingB" cx="30%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#F0DDFF" />
          <stop offset="60%" stopColor="#E7C6FF" />
          <stop offset="100%" stopColor="#7A4FB0" />
        </radialGradient>
      </defs>

      {/* Left wings */}
      <path d="M70 55 C36 8 4 16 12 44 C18 64 46 62 70 55 Z" fill="url(#wingA)" stroke="#C2478F" strokeWidth="1.6" />
      <path d="M70 57 C48 74 26 88 34 101 C43 110 62 82 70 57 Z" fill="url(#wingB)" stroke="#C2478F" strokeWidth="1.6" />
      {/* Right wings */}
      <path d="M70 55 C104 8 136 16 128 44 C122 64 94 62 70 55 Z" fill="url(#wingA)" stroke="#C2478F" strokeWidth="1.6" />
      <path d="M70 57 C92 74 114 88 106 101 C97 110 78 82 70 57 Z" fill="url(#wingB)" stroke="#C2478F" strokeWidth="1.6" />

      {/* Wing veins */}
      <path d="M70 55 C48 34 34 30 22 32 M70 55 C50 46 40 48 30 52" stroke="#FFF3B0" strokeWidth="1" opacity="0.65" />
      <path d="M70 55 C92 34 106 30 118 32 M70 55 C90 46 100 48 110 52" stroke="#FFF3B0" strokeWidth="1" opacity="0.65" />

      {/* Spots */}
      <circle cx="38" cy="42" r="5" fill="#FFF3B0" opacity="0.9" />
      <circle cx="102" cy="42" r="5" fill="#FFF3B0" opacity="0.9" />

      {/* Body */}
      <ellipse cx="70" cy="58" rx="3.6" ry="18" fill="#0F2D23" />
      {/* Antennae */}
      <path d="M70 42 C63 28 56 25 50 23 M70 42 C77 28 84 25 90 23" stroke="#0F2D23" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="50" cy="23" r="2.2" fill="#FFF3B0" />
      <circle cx="90" cy="23" r="2.2" fill="#FFF3B0" />
    </svg>
  );
}

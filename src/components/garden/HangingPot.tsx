import React from 'react';

// Hanging pot suspended by chains, overflowing with trailing flowers.
export default function HangingPot({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 340" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="potBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2f7d63" />
          <stop offset="55%" stopColor="#1c5241" />
          <stop offset="100%" stopColor="#0a1f18" />
        </linearGradient>
        <linearGradient id="potRim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF3B0" />
          <stop offset="100%" stopColor="#8a6c22" />
        </linearGradient>
        <linearGradient id="cord" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF3B0" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#FFF3B0" stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id="potLeaf" cx="38%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#3a9b7a" />
          <stop offset="100%" stopColor="#144234" />
        </radialGradient>
      </defs>

      {/* Chains */}
      <path d="M74 0 L92 118" stroke="url(#cord)" strokeWidth="3" />
      <path d="M146 0 L128 118" stroke="url(#cord)" strokeWidth="3" />
      <circle cx="92" cy="118" r="4" fill="url(#potRim)" />
      <circle cx="128" cy="118" r="4" fill="url(#potRim)" />

      {/* Pot */}
      <path d="M64 118 L156 118 L142 186 L78 186 Z" fill="url(#potBody)" stroke="#2a735c" strokeWidth="2.5" />
      <rect x="58" y="108" width="104" height="18" rx="8" fill="url(#potRim)" />
      <path d="M78 140 L142 140" stroke="#0a1f18" strokeWidth="2" opacity="0.4" />

      {/* Trailing vines */}
      {[
        ['M84 186 C74 232 96 268 78 324', 5],
        ['M118 186 C128 238 108 276 122 334', 6],
        ['M140 186 C154 228 138 272 152 320', 5],
      ].map(([d, w], i) => (
        <path key={i} d={d as string} stroke="url(#potBody)" strokeWidth={w as number} strokeLinecap="round" />
      ))}

      {/* Leaves */}
      {[[80, 220], [96, 252], [82, 288], [120, 224], [110, 262], [124, 300], [142, 220], [136, 256], [150, 292]].map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="10" ry="5.5" fill="url(#potLeaf)" transform={`rotate(${(i % 2 ? 1 : -1) * 42} ${x} ${y})`} />
      ))}

      {/* Blooms */}
      {[[80, 240], [122, 250], [142, 244], [104, 312], [150, 300]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle r="10" fill={i % 2 ? '#FFB5E8' : '#E7C6FF'} />
          <circle r="10" fill="none" stroke="#F58AD4" strokeWidth="1.4" />
          <circle r="5" fill="#F58AD4" />
          <circle r="2" fill="#FFF3B0" />
        </g>
      ))}
    </svg>
  );
}

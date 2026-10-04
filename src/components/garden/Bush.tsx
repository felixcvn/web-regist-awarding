import React from 'react';

// Lush garden bush — layered foliage with shading and scattered blooms.
const CLUSTERS: [number, number, number, number][] = [
  // x, y, rx, ry
  [50, 150, 46, 40], [92, 118, 54, 46], [140, 100, 58, 50], [190, 96, 60, 52],
  [240, 104, 56, 48], [282, 124, 50, 44], [312, 150, 44, 38],
  [70, 168, 44, 36], [150, 158, 60, 46], [230, 162, 52, 40],
  [110, 90, 34, 30], [210, 84, 36, 32],
];

const BLOOMS: [number, number, string][] = [
  [64, 120, '#FFB5E8'], [120, 96, '#E7C6FF'], [178, 80, '#FFB5E8'],
  [240, 92, '#E7C6FF'], [296, 118, '#FFB5E8'], [150, 140, '#FFB5E8'],
  [214, 146, '#E7C6FF'], [96, 156, '#E7C6FF'], [262, 160, '#FFB5E8'],
  [40, 150, '#FFB5E8'], [322, 150, '#E7C6FF'],
];

export default function Bush({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 220" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <radialGradient id="bushBase" cx="48%" cy="72%" r="78%">
          <stop offset="0%" stopColor="#3a9174" />
          <stop offset="52%" stopColor="#1c5241" />
          <stop offset="100%" stopColor="#081611" />
        </radialGradient>
        <radialGradient id="bushHi" cx="42%" cy="26%" r="48%">
          <stop offset="0%" stopColor="#D6FFF0" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#AFF8DB" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="leafCl" cx="36%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#4bb48d" />
          <stop offset="60%" stopColor="#276a52" />
          <stop offset="100%" stopColor="#0f2c22" />
        </radialGradient>
        <linearGradient id="bloomP" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFD9F0" />
          <stop offset="60%" stopColor="#FFB5E8" />
          <stop offset="100%" stopColor="#C2478F" />
        </linearGradient>
        <linearGradient id="bloomL" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F0DDFF" />
          <stop offset="60%" stopColor="#E7C6FF" />
          <stop offset="100%" stopColor="#7A4FB0" />
        </linearGradient>
      </defs>

      {/* Base mass */}
      {CLUSTERS.map(([x, y, rx, ry], i) => (
        <ellipse key={`b${i}`} cx={x} cy={y} rx={rx} ry={ry} fill="url(#bushBase)" />
      ))}

      {/* Individual leaf clusters + veins */}
      {CLUSTERS.map(([x, y, rx, ry], i) => (
        <g key={`c${i}`}>
          <ellipse cx={x - rx * 0.28} cy={y - ry * 0.28} rx={rx * 0.58} ry={ry * 0.58} fill="url(#leafCl)" />
          <ellipse cx={x - rx * 0.28} cy={y - ry * 0.28} rx={rx * 0.58} ry={ry * 0.58} fill="none" stroke="#2a735c" strokeWidth="1.4" opacity="0.5" />
          <path
            d={`M${x - rx * 0.7} ${y + ry * 0.3} Q${x} ${y - ry * 0.5} ${x + rx * 0.55} ${y - ry * 0.35}`}
            stroke="#0f2c22"
            strokeWidth="1.2"
            opacity="0.45"
            fill="none"
          />
        </g>
      ))}

      {/* Highlight sheen */}
      <ellipse cx="170" cy="116" rx="128" ry="86" fill="url(#bushHi)" />

      {/* Blooms (layered) */}
      {BLOOMS.map(([x, y, c], i) => (
        <g key={`f${i}`} transform={`translate(${x} ${y})`}>
          <circle r="11" fill="#081611" opacity="0.35" />
          <circle r="10" fill={c.startsWith('#E') ? 'url(#bloomL)' : 'url(#bloomP)'} />
          <path d="M0 -10 A 10 10 0 0 1 10 0" stroke="#ffffff" strokeWidth="1.3" opacity="0.4" fill="none" />
          <circle r="5" fill="#F58AD4" />
          <circle r="2" fill="#FFF3B0" />
        </g>
      ))}

      {/* Dew highlights */}
      <circle cx="170" cy="70" r="3" fill="#FFF3B0" opacity="0.9" />
      <circle cx="96" cy="98" r="2.4" fill="#AFF8DB" opacity="0.9" />
      <circle cx="250" cy="88" r="2.4" fill="#AFF8DB" opacity="0.9" />
    </svg>
  );
}

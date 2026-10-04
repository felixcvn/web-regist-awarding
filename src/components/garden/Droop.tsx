import React from 'react';

// Drooping vine draping from the top edge, with varied leaves and blossoms.
const VINES: [string, number][] = [
  ['M30 0 C18 70 62 120 40 190', 6],
  ['M96 0 C118 80 78 140 108 214', 7],
  ['M166 0 C150 60 190 130 162 200', 5],
  ['M236 0 C262 78 220 140 250 210', 7],
  ['M306 0 C288 66 330 120 304 196', 5],
  ['M372 0 C392 80 350 140 380 206', 6],
];

export default function Droop({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 410 230" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="droopStem" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#144234" />
          <stop offset="50%" stopColor="#2a735c" />
          <stop offset="100%" stopColor="#0f2c22" />
        </linearGradient>
        <radialGradient id="droopLeaf" cx="36%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#4bb48d" />
          <stop offset="60%" stopColor="#276a52" />
          <stop offset="100%" stopColor="#0f2c22" />
        </radialGradient>
        <linearGradient id="droopBloomP" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFD9F0" />
          <stop offset="60%" stopColor="#FFB5E8" />
          <stop offset="100%" stopColor="#C2478F" />
        </linearGradient>
        <linearGradient id="droopBloomL" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F0DDFF" />
          <stop offset="60%" stopColor="#E7C6FF" />
          <stop offset="100%" stopColor="#7A4FB0" />
        </linearGradient>
      </defs>

      {/* Stems */}
      {VINES.map(([d, w], i) => (
        <path key={i} d={d} stroke="url(#droopStem)" strokeWidth={w} strokeLinecap="round" />
      ))}

      {/* Leaves along each stem */}
      {VINES.flatMap(([,], vi) =>
        [40, 95, 150, 200].map((y, li) => {
          const x = [40, 108, 162, 250, 304, 380][vi] + (li % 2 ? 12 : -12);
          return (
            <ellipse
              key={`${vi}-${li}`}
              cx={x}
              cy={y}
              rx={17}
              ry={9}
              fill="url(#droopLeaf)"
              stroke="#2a735c"
              strokeWidth="1"
              opacity="0.95"
              transform={`rotate(${(li % 2 ? 1 : -1) * 40} ${x} ${y})`}
            />
          );
        })
      )}

      {/* Blossoms hanging (layered) */}
      {[[40, 196], [108, 220], [162, 206], [250, 216], [304, 202], [380, 212]].map(([x, y], i) => (
        <g key={`f${i}`} transform={`translate(${x} ${y})`}>
          <circle r="12" fill="#081611" opacity="0.35" />
          <circle r="12" fill={i % 2 ? 'url(#droopBloomP)' : 'url(#droopBloomL)'} />
          <path d="M0 -12 A 12 12 0 0 1 12 0" stroke="#fff" strokeWidth="1.3" opacity="0.4" fill="none" />
          <circle r="6" fill="#F58AD4" />
          <circle r="2.2" fill="#FFF3B0" />
        </g>
      ))}
    </svg>
  );
}

'use client';

import React from 'react';

// Secret Garden Gate — ornate wrought-iron archway between stone pillars,
// its doors held open, revealing a flower-filled garden with two lanterns.
// Built to span the full viewport (preserveAspectRatio="slice").
export default function Gate({
  open = 1,
  className = '',
}: {
  open?: number;
  className?: string;
}) {
  const t = Math.max(0, Math.min(1, open));
  const leftAngle = -t * 66;
  const rightAngle = t * 66;

  const pillarLeaves: [number, number][] = [
    [40, 360], [26, 300], [52, 244], [30, 192],
    [1180, 360], [1194, 300], [1168, 244], [1190, 192],
  ];

  return (
    <svg
      viewBox="0 0 1220 760"
      className={className}
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ironGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4ba583" />
          <stop offset="30%" stopColor="#1c5241" />
          <stop offset="100%" stopColor="#081611" />
        </linearGradient>
        <linearGradient id="ironHi" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#CFFAEA" stopOpacity="0.85" />
          <stop offset="45%" stopColor="#1c5241" stopOpacity="0" />
          <stop offset="100%" stopColor="#061510" stopOpacity="0.8" />
        </linearGradient>
        <linearGradient id="goldTrim" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFF7CE" />
          <stop offset="45%" stopColor="#d8b25a" />
          <stop offset="100%" stopColor="#6f5417" />
        </linearGradient>
        <linearGradient id="stoneGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5c6b62" />
          <stop offset="45%" stopColor="#33403a" />
          <stop offset="100%" stopColor="#161f1b" />
        </linearGradient>
        <radialGradient id="gardenDepth" cx="50%" cy="58%" r="62%">
          <stop offset="0%" stopColor="#FFB5E8" stopOpacity="0.55" />
          <stop offset="38%" stopColor="#2a735c" stopOpacity="0.5" />
          <stop offset="78%" stopColor="#0c2018" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#04100b" stopOpacity="1" />
        </radialGradient>
        <radialGradient id="archGlow" cx="50%" cy="26%" r="60%">
          <stop offset="0%" stopColor="#FFB5E8" stopOpacity="0.5" />
          <stop offset="60%" stopColor="#AFF8DB" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#061510" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="leafDark" cx="38%" cy="30%" r="72%">
          <stop offset="0%" stopColor="#3a9b7a" />
          <stop offset="100%" stopColor="#0f2c22" />
        </radialGradient>
        <radialGradient id="lanternGlass" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFF7CE" />
          <stop offset="55%" stopColor="#ffd97a" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#c98a2a" stopOpacity="0.5" />
        </radialGradient>
      </defs>

      {/* Deep garden beyond the gate */}
      <path d="M240 250 C240 55 980 55 980 250 L980 720 L240 720 Z" fill="url(#gardenDepth)" />
      <path d="M240 250 C240 55 980 55 980 250 L980 720 L240 720 Z" fill="url(#archGlow)" opacity="0.35" />

      {/* Distant garden flowers (perspective: small, faded) */}
      {[
        [330, 640, 12], [400, 660, 10], [470, 630, 13], [540, 668, 9], [620, 636, 12],
        [690, 662, 11], [760, 632, 13], [830, 660, 10], [900, 640, 12],
      ].map(([x, y, r], i) => (
        <g key={`gf${i}`} opacity="0.75">
          <circle cx={x} cy={y} r={r} fill={i % 2 ? '#FFB5E8' : '#E7C6FF'} />
          <circle cx={x} cy={y} r={r * 0.45} fill="#F58AD4" />
        </g>
      ))}
      {/* Distant foliage band */}
      <path d="M240 600 Q360 560 480 604 Q600 646 720 604 Q840 560 980 600 L980 720 L240 720 Z" fill="#0c271e" opacity="0.9" />
      <path d="M240 660 Q400 630 560 664 Q720 698 980 664 L980 720 L240 720 Z" fill="#071a14" />

      {/* Two lanterns hanging in the garden */}
      {[380, 840].map((x, i) => (
        <g key={`lan${i}`} transform={`translate(${x} 250)`}>
          <path d={`M0 0 L0 ${70}`} stroke="#7a5d1e" strokeWidth="2" />
          <rect x="-11" y="70" width="22" height="30" rx="5" fill="url(#lanternGlass)" stroke="url(#goldTrim)" strokeWidth="2" />
          <circle cx="0" cy="85" r="6" fill="#FFF7CE" className="animate-pulse" />
          <circle cx="0" cy="85" r="14" fill="#FFF3B0" opacity="0.25" />
        </g>
      ))}

      {/* Ground + shadow */}
      <ellipse cx="610" cy="728" rx="560" ry="32" fill="#03100b" opacity="0.75" />
      <rect x="0" y="710" width="1220" height="50" fill="#03100b" opacity="0.8" />

      {/* Stone pillars with texture + cast shadow */}
      {[188, 966].map((x, i) => (
        <g key={`pil${i}`}>
          <rect x={x + 6} y="190" width="66" height="516" rx="12" fill="#0a1410" opacity="0.5" />
          <rect x={x} y="150" width="66" height="556" rx="12" fill="url(#stoneGrad)" />
          <rect x={x} y="150" width="66" height="556" rx="12" fill="url(#ironHi)" opacity="0.45" />
          {/* stone block seams */}
          {[230, 320, 410, 500, 590].map((y, j) => (
            <line key={j} x1={x + 4} y1={y} x2={x + 62} y2={y} stroke="#0a1410" strokeWidth="2" opacity="0.4" />
          ))}
          {/* gold caps */}
          <rect x={x - 16} y="132" width="98" height="26" rx="8" fill="url(#goldTrim)" />
          <rect x={x - 6} y="158" width="78" height="10" rx="4" fill="#0a1f18" opacity="0.55" />
        </g>
      ))}

      {/* Wrought-iron arch */}
      <path d="M221 220 C221 -8 999 -8 999 220" stroke="url(#ironGrad)" strokeWidth="28" strokeLinecap="round" />
      <path d="M221 220 C221 -8 999 -8 999 220" stroke="url(#ironHi)" strokeWidth="7" strokeLinecap="round" opacity="0.55" />
      <path d="M262 236 C262 40 958 40 958 236" stroke="url(#goldTrim)" strokeWidth="6" strokeLinecap="round" opacity="0.85" />

      {/* Ornament curls along the arch */}
      {[310, 430, 610, 790, 910].map((x, i) => (
        <path
          key={i}
          d={`M${x} ${92 + Math.abs(610 - x) * 0.11} c -18 22 18 40 0 62`}
          stroke="url(#goldTrim)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
        />
      ))}

      {/* LEFT DOOR (held open, hinged at x=250) */}
      <g transform={`translate(250 250) rotate(${leftAngle}) translate(-250 -250)`}>
        <path d="M252 704 L252 258 C252 108 608 108 608 258 L608 704" stroke="url(#ironGrad)" strokeWidth="16" strokeLinecap="round" fill="none" />
        {[300, 350, 400, 450, 500, 550, 598].map((x, i) => (
          <path key={i} d={`M${x} ${x < 400 ? 230 : x < 520 ? 200 : 230} L${x} 690`} stroke="url(#ironGrad)" strokeWidth="7" strokeLinecap="round" />
        ))}
        <path d="M252 360 L608 340 M252 520 L608 520" stroke="url(#goldTrim)" strokeWidth="5" opacity="0.9" />
        {[300, 350, 400, 450, 500, 550, 598].map((x, i) => (
          <path key={i} d={`M${x} ${x < 400 ? 230 : x < 520 ? 200 : 230} l-7 16 h14 Z`} fill="url(#goldTrim)" />
        ))}
        <g transform="translate(430 560)">
          <circle r="26" fill="url(#goldTrim)" opacity="0.9" />
          <circle r="14" fill="#FFB5E8" />
          <circle r="6" fill="#F58AD4" />
          <circle r="2.5" fill="#FFF3B0" />
        </g>
      </g>

      {/* RIGHT DOOR (held open, hinged at x=970) */}
      <g transform={`translate(970 250) rotate(${rightAngle}) translate(-970 -250)`}>
        <path d="M970 704 L970 258 C970 108 612 108 612 258 L612 704" stroke="url(#ironGrad)" strokeWidth="16" strokeLinecap="round" fill="none" />
        {[920, 870, 820, 770, 720, 668].map((x, i) => (
          <path key={i} d={`M${x} ${x > 820 ? 230 : x > 700 ? 200 : 230} L${x} 690`} stroke="url(#ironGrad)" strokeWidth="7" strokeLinecap="round" />
        ))}
        <path d="M970 360 L612 340 M970 520 L612 520" stroke="url(#goldTrim)" strokeWidth="5" opacity="0.9" />
        {[920, 870, 820, 770, 720, 668].map((x, i) => (
          <path key={i} d={`M${x} ${x > 820 ? 230 : x > 700 ? 200 : 230} l-7 16 h14 Z`} fill="url(#goldTrim)" />
        ))}
        <g transform="translate(790 560)">
          <circle r="26" fill="url(#goldTrim)" opacity="0.9" />
          <circle r="14" fill="#E7C6FF" />
          <circle r="6" fill="#F58AD4" />
          <circle r="2.5" fill="#FFF3B0" />
        </g>
      </g>

      {/* Vines climbing pillars */}
      <path d="M221 640 C196 540 226 460 208 380 C196 320 222 250 210 190" stroke="#1c5241" strokeWidth="7" strokeLinecap="round" />
      <path d="M999 640 C1024 540 994 460 1012 380 C1024 320 998 250 1010 190" stroke="#1c5241" strokeWidth="7" strokeLinecap="round" />
      {pillarLeaves.map(([x, y], i) => (
        <ellipse key={i} cx={x} cy={y} rx="16" ry="8" fill="url(#leafDark)" transform={`rotate(${i % 2 ? 38 : -38} ${x} ${y})`} />
      ))}

      {/* Roses along the arch (layered petals) */}
      {[[300, 118], [400, 86], [510, 70], [610, 62], [710, 70], [820, 86], [920, 118]].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle r="16" fill="#C2478F" opacity="0.5" />
          <circle r="13" fill={i % 2 ? '#FFB5E8' : '#E7C6FF'} />
          <path d={`M0 -13 A 13 13 0 0 1 13 0`} stroke="#fff" strokeWidth="1.5" opacity="0.35" fill="none" />
          <circle r="7" fill="#F58AD4" />
          <circle r="3" fill="#FFF3B0" />
        </g>
      ))}

      {/* Top finial star */}
      <path d="M610 26 l9 20 22 3 -16 15 4 22 -19 -10 -19 10 4 -22 -16 -15 22 -3 Z" fill="url(#goldTrim)" />
      <circle cx="610" cy="4" r="3" fill="#FFF3B0" className="animate-pulse" />
    </svg>
  );
}

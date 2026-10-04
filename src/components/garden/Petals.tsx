'use client';

import React, { useMemo, useSyncExternalStore } from 'react';

const emptySubscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function useIsClient() {
  return useSyncExternalStore(emptySubscribe, getClientSnapshot, getServerSnapshot);
}

// Deterministic pseudo-random so SSR and client markup match.
function seeded(i: number, salt = 1) {
  const x = Math.sin(i * 12.9898 * salt + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

const PETAL_COLORS = ['#FFB5E8', '#FFD9F0', '#E7C6FF', '#FF8FC7'];

// Falling petals + rising fireflies. Rendered client-side only to avoid hydration mismatch.
export default function Petals({
  count = 18,
  fireflies = 14,
  className = '',
}: {
  count?: number;
  fireflies?: number;
  className?: string;
}) {
  const mounted = useIsClient();

  const petals = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => {
        const left = seeded(i, 1) * 100;
        const delay = seeded(i, 2) * 9;
        const dur = 7 + seeded(i, 3) * 6;
        const size = 8 + seeded(i, 4) * 10;
        const color = PETAL_COLORS[i % PETAL_COLORS.length];
        return { left, delay, dur, size, color };
      }),
    [count]
  );

  const bugs = useMemo(
    () =>
      Array.from({ length: fireflies }).map((_, i) => {
        const left = seeded(i, 5) * 100;
        const delay = seeded(i, 6) * 8;
        const dur = 6 + seeded(i, 7) * 6;
        const size = 3 + seeded(i, 8) * 4;
        const top = 30 + seeded(i, 9) * 65;
        return { left, delay, dur, size, top };
      }),
    [fireflies]
  );

  if (!mounted) return null;

  return (
    <div className={`pointer-events-none select-none overflow-hidden ${className}`} aria-hidden="true">
      {/* Falling petals */}
      {petals.map((p, i) => (
        <span
          key={`p${i}`}
          className="absolute top-0 animate-petal-fall rounded-[50%_0_50%_50%]"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.7,
            background: p.color,
            opacity: 0.85,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
          }}
        />
      ))}
      {/* Rising fireflies */}
      {bugs.map((b, i) => (
        <span
          key={`f${i}`}
          className="absolute animate-firefly-rise rounded-full"
          style={{
            left: `${b.left}%`,
            top: `${b.top}%`,
            width: b.size,
            height: b.size,
            background: i % 2 ? '#FFF3B0' : '#AFF8DB',
            boxShadow: `0 0 ${b.size * 3}px ${i % 2 ? '#FFF3B0' : '#AFF8DB'}`,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

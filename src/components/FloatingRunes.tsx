'use client';

import React from 'react';
import Card3D from './Card3D';

export default function FloatingRunes() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden select-none z-10" aria-hidden="true">
      {/* 3D Rune 1 - Left floating botanical seal */}
      <div className="absolute top-[28%] left-4 sm:left-12 animate-float-slow opacity-60 hover:opacity-100 transition-opacity">
        <Card3D glowColor="rgba(175, 248, 219, 0.4)">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#123e30]/80 to-[#071912]/90 border border-[#AFF8DB]/50 backdrop-blur-md flex items-center justify-center shadow-[0_0_25px_rgba(175,248,219,0.3)]">
            <svg viewBox="0 0 40 40" className="w-8 h-8 stroke-[#AFF8DB] fill-none" strokeWidth="1.5">
              <circle cx="20" cy="20" r="14" strokeDasharray="3 3" />
              <polygon points="20,8 30,26 10,26" />
              <circle cx="20" cy="20" r="3" fill="#FFF3B0" />
            </svg>
          </div>
        </Card3D>
      </div>

      {/* 3D Rune 2 - Right floating celestial crest */}
      <div
        className="absolute top-[42%] right-4 sm:right-14 animate-float-slow opacity-60 hover:opacity-100 transition-opacity"
        style={{ animationDelay: '2.5s' }}
      >
        <Card3D glowColor="rgba(255, 243, 176, 0.4)">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-[#2a2d15]/80 to-[#071912]/90 border border-[#FFF3B0]/50 backdrop-blur-md flex items-center justify-center shadow-[0_0_25px_rgba(255,243,176,0.3)]">
            <svg viewBox="0 0 40 40" className="w-8 h-8 stroke-[#FFF3B0] fill-none" strokeWidth="1.5">
              <rect x="10" y="10" width="20" height="20" rx="4" transform="rotate(45 20 20)" />
              <circle cx="20" cy="20" r="6" />
              <circle cx="20" cy="20" r="2" fill="#FFB5E8" />
            </svg>
          </div>
        </Card3D>
      </div>
    </div>
  );
}

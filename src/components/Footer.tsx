import React from 'react';
import GardenArtwork, { GARDEN_IMAGES } from './GardenArtwork';

export default function Footer() {
  return (
    <footer className="section-shade relative bg-surface-base border-t border-bloom-pink/20 text-ink py-14 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Gate silhouette closing the garden */}
      <div className="pointer-events-none absolute -bottom-1 left-1/2 -translate-x-1/2 w-[420px] sm:w-[560px] opacity-[0.13]" aria-hidden="true">
        <svg viewBox="0 0 400 260" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
          <path d="M60 250 L60 130 C60 20 340 20 340 130 L340 250" stroke="#B79CE8" strokeWidth="10" strokeLinecap="round" fill="none" />
          <path d="M92 250 L92 138 C92 55 308 55 308 138 L308 250" stroke="#FFB5E8" strokeWidth="6" strokeLinecap="round" strokeDasharray="4 10" fill="none" />
          {[120, 160, 200, 240, 280].map((x, i) => (
            <path key={i} d={`M${x} 160 L${x} 250`} stroke="#B79CE8" strokeWidth="5" strokeLinecap="round" />
          ))}
        </svg>
      </div>

      {/* Storybook grass tufts at the base */}
      <GardenArtwork
        src={GARDEN_IMAGES.grassRight}
        className="absolute -bottom-2 left-[4%] w-28 sm:w-40 z-0 opacity-80 scale-x-[-1]"
      />
      <GardenArtwork
        src={GARDEN_IMAGES.grassRight}
        className="absolute -bottom-2 right-[4%] w-28 sm:w-40 z-0 opacity-80"
      />

      {/* Ground line */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#0e0a16] to-transparent" aria-hidden="true" />

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 relative z-10 text-center md:text-left">
        
        {/* Left branding */}
        <div>
          <div className="flex items-center justify-center md:justify-start gap-2.5 mb-1.5">
            <span className="font-cinzel font-bold text-lg text-gold">
              FASILKOM AWARDING NIGHT 2026
            </span>
          </div>
          <p className="text-xs text-ink/60 font-light">
            Secret Garden: Dreams to History &bull; Fakultas Ilmu Komputer, Universitas Jember
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-ink/75">
          <a href="#tentang" className="hover:text-bloom-pink transition-colors">
            Informasi Acara
          </a>
          <a href="#rundown" className="hover:text-bloom-pink transition-colors">
            Rundown
          </a>
          <a href="#insight" className="hover:text-bloom-pink transition-colors">
            Kilas Balik
          </a>
          <a href="#galeri" className="hover:text-bloom-pink transition-colors">
            Dokumentasi
          </a>
        </div>
      </div>
    </footer>
  );
}

'use client';

import React, { useRef } from 'react';
import { Calendar, MapPin, Ticket, ArrowDown } from 'lucide-react';
import Countdown from './Countdown';
import Petals from './garden/Petals';
import Card3D from './Card3D';

export default function Hero() {
  const sectionRef = useRef<HTMLElement | null>(null);

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen pt-32 pb-24 px-4 sm:px-6 lg:px-8 flex flex-col justify-between overflow-hidden"
    >
      {/* Background vignette inside Hero for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#140d1f]/70 via-[#1a1030]/45 to-[#140d1f]/90" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_25%,rgba(12,6,18,0.7)_100%)]" />

      {/* Petals + fireflies ambience in Hero */}
      <Petals className="absolute inset-0 z-10" count={14} fireflies={12} />

        {/* Content Container */}
        <div className="relative z-40 max-w-4xl mx-auto text-center my-auto pt-6 sm:pt-10">
        
        {/* Subtitle Badge */}
        <div className="inline-flex items-center gap-2.5 px-4.5 py-1.5 rounded-full bg-surface-card/85 border border-bloom-pink/35 text-bloom-pink text-xs sm:text-sm font-semibold tracking-[0.25em] uppercase mb-6 shadow-[0_0_25px_rgba(255, 181, 232,0.2)] backdrop-blur-md">
          The Secret Garden of Dreams
        </div>

        {/* Main Title */}
        <h1 className="font-cinzel font-black text-3xl sm:text-5xl md:text-6xl lg:text-7xl tracking-wider text-ivory drop-shadow-[0_4px_25px_rgba(0,0,0,0.85)] leading-[1.12] mb-4">
          FASILKOM <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-bloom-pink via-blush to-gold text-glow-pink">
            AWARDING NIGHT
          </span>
          <span className="block text-2xl sm:text-4xl text-gold font-normal tracking-[0.35em] mt-2.5 font-cinzel">
            2 0 2 6
          </span>
        </h1>

        {/* Theme Title & Tagline */}
        <div className="max-w-2xl mx-auto mb-9">
          <p className="font-cinzel text-base sm:text-xl text-bloom-pink font-semibold tracking-wide mb-2.5 text-glow-pink">
            &ldquo;Secret Garden: Dreams to History&rdquo;
          </p>
          <p className="text-xs sm:text-sm text-ink/80 font-light leading-relaxed">
            <span className="italic text-gold">Every Dream Blooms into History</span> — Ruang bertumbuhnya mimpi, dedikasi, dan potensi seluruh civitas Fasilkom UNEJ yang mekar menjadi jejak sejarah membanggakan.
          </p>
        </div>

        {/* Date & Location Pill */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 sm:gap-6 text-xs sm:text-sm text-ink/90 font-medium mb-10">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-surface-card-2/85 border border-bloom-pink/25 shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-md hover:border-bloom-pink/50 transition-colors">
            <Calendar className="w-4 h-4 text-bloom-pink" />
            <span>Selasa, 1 Desember 2026</span>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-surface-card-2/85 border border-bloom-pink/25 shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-md hover:border-bloom-pink/50 transition-colors">
            <MapPin className="w-4 h-4 text-bloom-pink" />
            <span>Gedung Soerachman, Universitas Jember</span>
          </div>
        </div>

        {/* Countdown Component */}
        <div className="mb-10">
          <Card3D glowColor="rgba(255, 181, 232, 0.2)">
            <Countdown targetDate="2026-12-01T18:00:00" />
          </Card3D>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#registrasi"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-bloom-pink hover:bg-bloom-pink-deep text-on-accent font-bold text-base tracking-wide shadow-[0_0_30px_rgba(255, 181, 232,0.6)] hover:shadow-[0_0_50px_rgba(255, 181, 232,0.9)] hover:scale-105 active:scale-95 transition-all duration-300"
          >
            <Ticket className="w-5 h-5 text-on-accent" />
            Konfirmasi Kehadiran & Ambil Tiket
          </a>

          <a
            href="#tentang"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-surface-card-2/85 hover:bg-surface-card border border-gold/30 hover:border-gold/60 text-gold font-medium text-base tracking-wide transition-all backdrop-blur-md"
          >
            Pelajari Detail Acara
</a>
        </div>

        {/* Scroll indicator */}
        <div className="relative z-40 text-center pt-8">
          <a href="#tentang" className="inline-flex flex-col items-center gap-1.5 text-xs text-ink/50 hover:text-bloom-pink transition-colors">
            <span>Jelajahi Malam Penganugerahan</span>
            <ArrowDown className="w-4 h-4 animate-bounce text-bloom-pink" />
          </a>
        </div>
      </div>
    </section>
  );
}

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Calendar, MapPin, Ticket, ArrowDown } from 'lucide-react';
import Countdown from './Countdown';
import GardenArtwork, { GARDEN_IMAGES } from './GardenArtwork';
import Petals from './garden/Petals';
import Card3D from './Card3D';
import { usePrefersReducedMotion } from '@/lib/useGardenMotion';

export default function Hero() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [introDone, setIntroDone] = useState(false);
  const reduced = usePrefersReducedMotion();

  // Opening sequence: the camera dollies forward, through the gate, into the garden (~2.5s).
  useEffect(() => {
    if (reduced) {
      const id = requestAnimationFrame(() => {
        setProgress(1);
        setIntroDone(true);
      });
      return () => cancelAnimationFrame(id);
    }
    const duration = 2500;
    const start = performance.now();
    let raf = 0;

    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const easeIn = p * p; // accelerate into the garden
      setProgress(easeIn);
      if (p < 1) {
        raf = requestAnimationFrame(step);
      } else {
        setIntroDone(true);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  // Lock scrolling while the intro is on screen.
  useEffect(() => {
    if (introDone) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [introDone]);

  // Camera scale: 1 -> 2.2, straight forward.
  const camScale = 1 + progress * 1.2;

  return (
    <>
      {/* Full-screen garden intro overlay — dolly into the wisteria gateway */}
      {!introDone && (
        <div
          className="fixed inset-0 z-[90] overflow-hidden bg-[#140d1f] transition-opacity duration-700"
          style={{ opacity: progress >= 1 ? 0 : 1 }}
          aria-hidden="true"
        >
          {/* The gateway we walk through, scaling up as the camera moves forward */}
          <div className="absolute inset-0 origin-center will-change-transform" style={{ transform: `scale(${camScale})` }}>
            <GardenArtwork
              src={GARDEN_IMAGES.gateway}
              objectFit="cover"
              priority
              className="absolute inset-0 w-full h-full"
            />
          </div>

          {/* Garden light blooming as we approach */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_52%,rgba(255,181,232,0.25)_0%,transparent_45%)]" />

          {/* Petals + fireflies ambience */}
          <Petals className="absolute inset-0" count={22} fireflies={18} />

          {/* Foreground vignette for depth */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_32%,rgba(12,6,18,0.9)_100%)]" />

          <p className="absolute bottom-10 left-1/2 -translate-x-1/2 text-xs sm:text-sm tracking-[0.35em] uppercase text-bloom-pink/80 font-cinzel animate-pulse">
            Entering the Secret Garden
          </p>
        </div>
      )}

      <section
        ref={sectionRef}
        className="relative min-h-screen pt-32 pb-24 px-4 sm:px-6 lg:px-8 flex flex-col justify-between overflow-hidden bg-vignette bg-film"
      >
        {/* 1. Real garden gateway backdrop (full-bleed) */}
        <GardenArtwork
          src={GARDEN_IMAGES.gateway}
          objectFit="cover"
          priority
          className="absolute inset-0 w-full h-full z-0"
        />

        {/* Darkening scrim so content stays readable over the photo */}
        <div className="absolute inset-0 z-0 bg-gradient-to-b from-[#140d1f]/70 via-[#1a1030]/45 to-[#140d1f]/90" />
        <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_45%,transparent_25%,rgba(12,6,18,0.7)_100%)]" />

        {/* 2. Hanging wisteria border across the top (full screen width) */}
        <GardenArtwork
          src={GARDEN_IMAGES.wisteriaBorder}
          interaction="swaySoft"
          className="absolute -top-20 sm:-top-28 left-0 w-full z-20 origin-top opacity-95"
        />

        {/* 4. Foreground blurred blooms for immersive depth */}
        <GardenArtwork
          src={GARDEN_IMAGES.wisteriaC}
          blur={6}
          className="absolute -bottom-8 -left-10 w-40 sm:w-64 z-30 origin-bottom"
        />
        <GardenArtwork
          src={GARDEN_IMAGES.wisteriaC}
          blur={6}
          className="absolute -bottom-8 -right-10 w-40 sm:w-64 z-30 origin-bottom scale-x-[-1]"
        />

        {/* Petals + fireflies ambience in Hero */}
        <Petals className="absolute inset-0 z-10" count={14} fireflies={12} />

        {/* 6. Content Container — reveals after the gate opens */}
        <div
          className={`relative z-40 max-w-4xl mx-auto text-center my-auto pt-6 sm:pt-10 transition-all duration-[1200ms] ease-out ${
            introDone ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
        
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
            <span>Auditorium Gedung Biru, Fasilkom UNEJ</span>
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

      </div>

      {/* Scroll indicator */}
      <div className="relative z-40 text-center pt-8">
        <a
          href="#tentang"
          className="inline-flex flex-col items-center gap-1.5 text-xs text-ink/50 hover:text-bloom-pink transition-colors"
        >
          <span>Jelajahi Malam Penganugerahan</span>
          <ArrowDown className="w-4 h-4 animate-bounce text-bloom-pink" />
        </a>
      </div>

    </section>
    </>
  );
}

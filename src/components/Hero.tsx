'use client';

import React from 'react';
import Image from 'next/image';
import { Calendar, MapPin, Ticket, ArrowDown } from 'lucide-react';
import Countdown from './Countdown';
import { RoyalGardenArch, BotanicalCornerFiligree, Lantern, StarlightGlow } from './BotanicalDecoration';
import Card3D from './Card3D';

export default function Hero() {
  return (
    <section className="relative min-h-screen pt-32 pb-24 px-4 sm:px-6 lg:px-8 flex flex-col justify-between overflow-hidden bg-vignette">
      
      {/* 1. Royal Botanical Arch & Corner Filigrees */}
      <RoyalGardenArch className="h-44 sm:h-56" />
      <BotanicalCornerFiligree position="top-left" className="opacity-80" />
      <BotanicalCornerFiligree position="top-right" className="opacity-80" />

      {/* 2. Hanging Fairy Lanterns */}
      <div className="absolute top-0 left-6 sm:left-14 lg:left-24 z-20 hidden md:block animate-sway origin-top">
        <Lantern />
      </div>
      <div className="absolute top-0 right-6 sm:right-14 lg:right-24 z-20 hidden md:block animate-sway origin-top" style={{ animationDelay: '2s' }}>
        <Lantern />
      </div>

      {/* 3. Ambient Magical Lighting Layers */}
      <StarlightGlow className="absolute -top-20 -left-20 w-[450px] h-[450px] bg-[#AFF8DB]/15" />
      <StarlightGlow className="absolute -top-20 -right-20 w-[450px] h-[450px] bg-[#FFF3B0]/15" />
      <StarlightGlow className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] sm:w-[850px] h-[500px] sm:h-[650px] bg-gradient-to-b from-[#AFF8DB]/10 via-[#E7C6FF]/5 to-[#FFF3B0]/5" />
      <StarlightGlow className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[700px] h-72 bg-[#0F2D25]/45" />

      {/* 4. Content Container with pristine luxury layout */}
      <div className="relative z-20 max-w-4xl mx-auto text-center my-auto pt-6 sm:pt-10">
        
        {/* Subtitle Badge */}
        <div className="inline-flex items-center gap-2.5 px-4.5 py-1.5 rounded-full bg-[#0F2F23]/85 border border-[#AFF8DB]/35 text-[#AFF8DB] text-xs sm:text-sm font-semibold tracking-[0.25em] uppercase mb-6 shadow-[0_0_25px_rgba(175,248,219,0.2)] backdrop-blur-md">
          The Secret Garden of Dreams
        </div>

        {/* Main Title */}
        <h1 className="font-cinzel font-black text-3xl sm:text-5xl md:text-6xl lg:text-7xl tracking-wider text-[#FAF7F0] drop-shadow-[0_4px_25px_rgba(0,0,0,0.85)] leading-[1.12] mb-4">
          FASILKOM <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFF3B0] via-[#AFF8DB] to-[#FFB5E8] text-glow-mint">
            AWARDING NIGHT
          </span>
          <span className="block text-2xl sm:text-4xl text-[#FFF3B0] font-normal tracking-[0.35em] mt-2.5 font-cinzel">
            2 0 2 6
          </span>
        </h1>

        {/* Theme Title & Tagline */}
        <div className="max-w-2xl mx-auto mb-9">
          <p className="font-cinzel text-base sm:text-xl text-[#AFF8DB] font-semibold tracking-wide mb-2.5 text-glow-mint">
            &ldquo;Secret Garden: Dreams to History&rdquo;
          </p>
          <p className="text-xs sm:text-sm text-[#EDE8DF]/80 font-light leading-relaxed">
            <span className="italic text-[#FFF3B0]">Every Dream Blooms into History</span> — Ruang bertumbuhnya mimpi, dedikasi, dan potensi seluruh civitas Fasilkom UNEJ yang mekar menjadi jejak sejarah membanggakan.
          </p>
        </div>

        {/* Date & Location Pill */}
        <div className="flex flex-wrap items-center justify-center gap-3.5 sm:gap-6 text-xs sm:text-sm text-[#EDE8DF]/90 font-medium mb-10">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#091F18]/85 border border-[#AFF8DB]/25 shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-md hover:border-[#AFF8DB]/50 transition-colors">
            <Calendar className="w-4 h-4 text-[#AFF8DB]" />
            <span>Selasa, 1 Desember 2026</span>
          </div>
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[#091F18]/85 border border-[#AFF8DB]/25 shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-md hover:border-[#AFF8DB]/50 transition-colors">
            <MapPin className="w-4 h-4 text-[#FFB5E8]" />
            <span>Auditorium Gedung Biru, Fasilkom UNEJ</span>
          </div>
        </div>

        {/* Countdown Component */}
        <div className="mb-10">
          <Card3D glowColor="rgba(175, 248, 219, 0.2)">
            <Countdown targetDate="2026-12-01T18:00:00" />
          </Card3D>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="#registrasi"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-[#AFF8DB] hover:bg-[#86efc3] text-[#061811] font-bold text-base tracking-wide shadow-[0_0_30px_rgba(175,248,219,0.6)] hover:shadow-[0_0_50px_rgba(175,248,219,0.9)] hover:scale-105 active:scale-95 transition-all duration-300"
          >
            <Ticket className="w-5 h-5 text-[#061811]" />
            Konfirmasi Kehadiran & Ambil Tiket
          </a>

          <a
            href="#tentang"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl bg-[#0A221A]/85 hover:bg-[#113529] border border-[#FFF3B0]/30 hover:border-[#FFF3B0]/60 text-[#FFF3B0] font-medium text-base tracking-wide transition-all backdrop-blur-md"
          >
            Pelajari Detail Acara
          </a>
        </div>

      </div>

      {/* Scroll indicator */}
      <div className="relative z-20 text-center pt-8">
        <a
          href="#tentang"
          className="inline-flex flex-col items-center gap-1.5 text-xs text-[#EDE8DF]/50 hover:text-[#AFF8DB] transition-colors"
        >
          <span>Jelajahi Malam Penganugerahan</span>
          <ArrowDown className="w-4 h-4 animate-bounce text-[#AFF8DB]" />
        </a>
      </div>

    </section>
  );
}

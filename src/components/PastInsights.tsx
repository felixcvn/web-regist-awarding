'use client';

import React from 'react';
import { Award, Users, Trophy, Star } from 'lucide-react';
import { StarlightGlow } from './StarlightGlow';
import ScrollReveal from './ScrollReveal';

export default function PastInsights() {
  const stats = [
    {
      label: 'Tamu Hadir & Audiens',
      value: '600+',
      desc: 'Mahasiswa, Dosen, Staf & Alumni Fasilkom',
      icon: Users,
      accent: '#FFB5E8',
    },
    {
      label: 'Kategori Penghargaan',
      value: '15',
      desc: 'Akademik, Organisasi, Riset & Pengabdian',
      icon: Trophy,
      accent: '#FFF3B0',
    },
    {
      label: 'Nominasi Berbakat',
      value: '76',
      desc: 'Kandidat terkurasi dari seluruh program studi',
      icon: Award,
      accent: '#AFF8DB',
    },
    {
      label: 'Tingkat Kepuasan',
      value: '99.4%',
      desc: 'Rating kepuasan penyelenggaraan edisi 2025',
      icon: Star,
      accent: '#E7C6FF',
    },
  ];

  return (
    <section id="insight" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-transparent text-ink overflow-hidden">

      {/* Background ambient glow */}
      <StarlightGlow className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-surface-card/25 via-lavender/10 to-transparent" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Section Header */}
        <ScrollReveal animation="fade-up">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-card text-gold text-xs font-semibold tracking-widest uppercase mb-3 border border-gold/30">
              Blooms into History
            </div>
            <h2 className="font-cinzel text-3xl sm:text-4xl md:text-5xl font-extrabold text-ivory tracking-wide">
              Jejak & Sejarah Prestasi
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-gold to-transparent mx-auto mt-4" />
            <p className="text-sm sm:text-base text-ink/80 mt-4 leading-relaxed font-light">
              Menengok kembali taman mimpi yang telah mekar menjadi sejarah membanggakan bagi individu, UKM, dan Ormawa Fasilkom UNEJ.
            </p>
          </div>
        </ScrollReveal>

        {/* 4 Big Numbers / Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-16">
          {stats.map((item, index) => {
            const Icon = item.icon;
            return (
              <ScrollReveal key={index} animation="fade-up" delay={index * 100}>
                <div className="relative rounded-3xl p-6 bg-gradient-to-b from-surface-card-2/90 to-surface-base/90 border border-bloom-pink/20 hover:border-bloom-pink/50 transition-all duration-300 shadow-xl group h-full">
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                    style={{ backgroundColor: `${item.accent}20`, border: `1px solid ${item.accent}50`, color: item.accent }}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <div
                    className="font-cinzel font-black text-3xl sm:text-4xl lg:text-5xl tracking-tight mb-1"
                    style={{ color: item.accent }}
                  >
                    {item.value}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-ivory mb-1">
                    {item.label}
                  </div>
                  <div className="text-[11px] sm:text-xs text-ink/60 leading-relaxed font-light">
                    {item.desc}
                  </div>
                </div>
              </ScrollReveal>
            );
          })}
        </div>

      </div>
    </section>
  );
}

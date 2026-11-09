'use client';

import React from 'react';
import { Users, Trophy } from 'lucide-react';
import { StarlightGlow } from './StarlightGlow';
import ScrollReveal from './ScrollReveal';

export default function PastInsights() {
  const stats = [
    {
      id: 'audience',
      label: 'Tamu Hadir & Audiens',
      value: '600+',
      desc: 'Satu malam untuk berbagi inspirasi, mempererat kebersamaan, dan merayakan perjalanan serta pencapaian yang membanggakan bagi Fasilkom.',
      detailsLabel: 'Keluarga besar Fasilkom',
      details: ['Mahasiswa', 'Dosen', 'Staf', 'Alumni'],
      icon: Users,
      accent: '#FFB5E8',
    },
    {
      id: 'awards',
      label: 'Kategori Penghargaan',
      value: '15',
      desc: 'Apresiasi atas dedikasi, karya, dan kontribusi Sivitas Akademika Fasilkom yang menginspirasi serta membawa dampak bagi Fakultas dan Universitas.',
      detailsLabel: 'Bidang yang diapresiasi',
      details: ['Akademik', 'Organisasi', 'Program Studi', 'Dosen'],
      icon: Trophy,
      accent: '#FFF3B0',
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
              Menengok kembali taman mimpi yang telah mekar menjadi sejarah membanggakan bagi Sivitas Akademika Fasilkom UNEJ.
            </p>
          </div>
        </ScrollReveal>

        {/* Full-width event metrics */}
        <div className="grid w-full grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-16">
          {stats.map((item, index) => {
            const Icon = item.icon;
            return (
              <ScrollReveal
                key={item.id}
                animation="fade-up"
                delay={index * 100}
                className="h-full motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none"
              >
                <article
                  aria-labelledby={`insight-${item.id}-title`}
                  className="relative flex h-full flex-col rounded-3xl p-6 sm:p-7 lg:p-8 bg-gradient-to-b from-surface-card-2/95 to-surface-base/95 border border-bloom-pink/20 hover:border-bloom-pink/50 transition-colors duration-300 shadow-xl"
                >
                  <div className="flex items-start justify-between gap-4">
                    <p
                      className="min-w-0 font-cinzel font-black text-6xl lg:text-7xl xl:text-8xl leading-none tracking-tight"
                      style={{ color: item.accent }}
                    >
                      {item.value}
                    </p>
                    <div
                      aria-hidden="true"
                      className="w-12 h-12 lg:w-14 lg:h-14 shrink-0 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: `${item.accent}20`, border: `1px solid ${item.accent}50`, color: item.accent }}
                    >
                      <Icon className="w-6 h-6 lg:w-7 lg:h-7" />
                    </div>
                  </div>
                  <h3 id={`insight-${item.id}-title`} className="text-xl lg:text-2xl font-bold leading-snug text-ivory mt-4">
                    {item.label}
                  </h3>
                  <p className="text-sm lg:text-base text-ink/80 leading-relaxed mt-3">
                    {item.desc}
                  </p>
                  <div className="mt-auto pt-6">
                    <div className="border-t border-ink/10 pt-5">
                      <p className="text-xs font-medium text-ink/60">{item.detailsLabel}</p>
                      <ul className="grid grid-cols-2 xl:grid-cols-4 gap-x-4 gap-y-3 mt-3">
                        {item.details.map((detail) => (
                          <li
                            key={detail}
                            className="border-l-2 pl-3 text-sm font-medium leading-snug text-ink/90"
                            style={{ borderColor: `${item.accent}70` }}
                          >
                            {detail}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </article>
              </ScrollReveal>
            );
          })}
        </div>

      </div>
    </section>
  );
}

'use client';

import React from 'react';
import Image from 'next/image';
import { StarlightGlow, BotanicalCornerFiligree } from './BotanicalDecoration';
import ScrollReveal from './ScrollReveal';

interface GalleryItem {
  id: number;
  image: string;
  alt: string;
}

export default function Gallery() {
  const galleryItems: GalleryItem[] = [
    {
      id: 1,
      image: '/DSC01955.JPG',
      alt: 'Dokumentasi Fasilkom Awarding Night 1',
    },
    {
      id: 2,
      image: '/IMG_6342.JPG',
      alt: 'Dokumentasi Fasilkom Awarding Night 2',
    },
    {
      id: 3,
      image: '/IMG_6647.JPG',
      alt: 'Dokumentasi Fasilkom Awarding Night 3',
    },
    {
      id: 4,
      image: '/DSC01840.JPG',
      alt: 'Dokumentasi Fasilkom Awarding Night 4',
    },
    {
      id: 5,
      image: '/IMG_6572.JPG',
      alt: 'Dokumentasi Fasilkom Awarding Night 5',
    },
    {
      id: 6,
      image: '/FAI00111.JPG',
      alt: 'Dokumentasi Fasilkom Awarding Night 6',
    },
  ];

  return (
    <section id="galeri" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-[#081a14] text-[#EDE8DF] overflow-hidden">
      
      {/* Botanical Corner Filigrees */}
      <BotanicalCornerFiligree position="top-right" className="opacity-35" />
      <BotanicalCornerFiligree position="bottom-left" className="opacity-35" />

      {/* Ambient Glows */}
      <StarlightGlow className="absolute top-1/3 right-10 w-80 h-80 bg-[#FFB5E8]/10" />
      <StarlightGlow className="absolute bottom-10 left-10 w-96 h-96 bg-[#AFF8DB]/10" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Section Title */}
        <ScrollReveal animation="fade-up">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#12382B] text-[#FFB5E8] text-xs font-semibold tracking-widest uppercase mb-3 border border-[#FFB5E8]/30">
              Galeri & Dokumentasi
            </div>
            <h2 className="font-cinzel text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#FAF7F0] tracking-wide">
              Potret Kenangan Edisi Sebelumnya
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-[#FFB5E8] to-transparent mx-auto mt-4" />
            <p className="text-sm sm:text-base text-[#EDE8DF]/80 mt-4 leading-relaxed font-light">
              Kilasan momen magis, kehangatan panggung, dan apresiasi tulus yang diabadikan dari perhelatan Fasilkom Awarding Night.
            </p>
          </div>
        </ScrollReveal>

        {/* Gallery Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {galleryItems.map((item, idx) => (
            <ScrollReveal key={item.id} animation="zoom-in" delay={idx * 80}>
              <div className="group relative overflow-hidden rounded-3xl border border-[#AFF8DB]/25 hover:border-[#FFF3B0]/70 transition-all duration-500 shadow-xl bg-[#061510] aspect-[16/10] w-full">
                <Image
                  src={item.image}
                  alt={item.alt}
                  fill
                  unoptimized
                  className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-108"
                />
              </div>
            </ScrollReveal>
          ))}
        </div>

      </div>
    </section>
  );
}

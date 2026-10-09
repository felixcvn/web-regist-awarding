'use client';

import React from 'react';
import Image from 'next/image';
import { StarlightGlow } from './StarlightGlow';
import GardenArtwork, { GARDEN_IMAGES } from './GardenArtwork';
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
    <section id="galeri" className="section-shade relative py-24 px-4 sm:px-6 lg:px-8 bg-transparent text-ink overflow-hidden">

      {/* Ambient Glow */}
      <StarlightGlow className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-surface-card/30" />

      {/* Small butterfly accent wandering near the title */}
      <GardenArtwork
        src={GARDEN_IMAGES.butterfly}
        interaction="float"
        className="absolute top-16 right-[12%] w-16 sm:w-24 z-0 opacity-70"
      />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Section Title */}
        <ScrollReveal animation="fade-up">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-card text-bloom-pink text-xs font-semibold tracking-widest uppercase mb-3 border border-bloom-pink/30">
              Galeri & Dokumentasi
            </div>
            <h2 className="font-cinzel text-3xl sm:text-4xl md:text-5xl font-extrabold text-ivory tracking-wide">
              Potret Kenangan Edisi Sebelumnya
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-bloom-pink to-transparent mx-auto mt-4" />
            <p className="text-sm sm:text-base text-ink/80 mt-4 leading-relaxed font-light">
              Kilasan momen magis, kehangatan panggung, dan apresiasi tulus yang diabadikan dari perhelatan Fasilkom Awarding Night.
            </p>
          </div>
        </ScrollReveal>

        {/* Gallery Grid — framed by garden arches */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {galleryItems.map((item, idx) => (
            <ScrollReveal key={item.id} animation="zoom-in" delay={idx * 80}>
              <div className="group relative pt-6 px-2">
                {/* arch frame */}
                <div className="relative aspect-[4/5] rounded-t-[45%] rounded-b-[1.5rem] border-2 border-bloom-pink/30 group-hover:border-gold/70 transition-colors duration-500 shadow-xl overflow-hidden bg-surface-base">
                  {/* inner hairline arch */}
                  <div className="absolute inset-2 rounded-t-[45%] rounded-b-xl border border-bloom-pink/20 pointer-events-none z-20" />
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    unoptimized
                    className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-108"
                  />
                  {/* inner glow from within the arch on hover */}
                  <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_120%,rgba(255,181,232,0.35),transparent_60%)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-0 z-10 bg-gradient-to-t from-surface-base/70 via-transparent to-transparent" />
                </div>

                {/* top keystone ornament */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-gradient-to-br from-gold to-bloom-pink-deep shadow-[0_0_12px_rgba(255,181,232,0.6)] z-30" />
              </div>
            </ScrollReveal>
          ))}
        </div>

      </div>
    </section>
  );
}

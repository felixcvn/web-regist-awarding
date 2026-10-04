'use client';

import React from 'react';
import Image from 'next/image';
import { Calendar, MapPin, Shirt, Award, Music, Camera } from 'lucide-react';
import { StarlightGlow } from './StarlightGlow';
import GardenArtwork, { GARDEN_IMAGES } from './GardenArtwork';
import ScrollReveal from './ScrollReveal';

export default function EventDetails() {

  const rundownItems = [
    {
      time: '17:30 - 18:30 WIB',
      title: 'Red Carpet, Registration & Welcome Drink',
      desc: 'Penyambutan tamu, photobooth, scan QR code tiket masuk, dan registrasi doorprize.',
      icon: Camera,
      tag: 'Opening Phase',
    },
    {
      time: '18:30 - 19:00 WIB',
      title: 'Grand Opening & Enchanted Orchestra',
      desc: 'Tari pembuka tematik "Botanical Fairy Tale" dan sambutan Dekan Fasilkom UNEJ.',
      icon: Music,
      tag: 'Ceremony',
    },
    {
      time: '19:00 - 20:15 WIB',
      title: 'Awarding Session 1: Academic & Research',
      desc: 'Penganugerahan Kategori Mahasiswa Berprestasi, Dosen Terfavorit, dan Riset Unggulan 2026.',
      icon: Award,
      tag: 'Penganugerahan',
    },
    {
      time: '20:15 - 20:45 WIB',
      title: 'Special Performance & Dinner Banquet',
      desc: 'Makan malam bersama diiringi penampilan musik akustik civitas Fasilkom.',
      icon: Music,
      tag: 'Intermezzo',
    },
    {
      time: '20:45 - 21:45 WIB',
      title: 'Awarding Session 2 & Grand Trophy',
      desc: 'Pengumuman Organisasi Mahasiswa Terbaik, Duta Fasilkom 2026, dan Pengumuman Doorprize Utama.',
      icon: Award,
      tag: 'Puncak Acara',
    },
    {
      time: '21:45 - 22:00 WIB',
      title: 'Closing Ceremony & Photo Session',
      desc: 'Sesi dokumentasi bersama seluruh jajaran pimpinan, panitia, pemenang, dan audiens.',
      icon: Camera,
      tag: 'Penutupan',
    },
  ];

  const outfitInspirations = [
    {
      title: 'Cottagecore & Botanical Gentleman',
      category: 'Pria (Formal Tematik)',
      desc: 'Perpaduan kemeja earth-tone, vest rajut/semi-formal bernuansa emerald & celana bahan tailored.',
      image: '/mens cottagecore fashion.jpeg',
    },
    {
      title: 'Fairy Forest Emerald Gown',
      category: 'Wanita (Gaun / Dress)',
      desc: 'Gaun satin/tulle beraksen floral lace nuansa deep emerald green & mint starlight.',
      image: '/download (36).jpeg',
    },
    {
      title: 'Elegant Modern Cottagecore Chic',
      category: 'Wanita (Semi-Formal)',
      desc: 'Dress midi floral dengan aksen korset/layering lembut nuansa botanical pastel.',
      image: '/rekomendasi outfit wanita kekinian.jpeg',
    },
    {
      title: 'Vintage Enchanted Garden Attire',
      category: 'Wanita (Gala Dress)',
      desc: 'Siluet klasik bertema Secret Garden dengan detail bordir bunga dan aksen keemasan.',
      image: '/download (40).jpeg',
    },
  ];

  return (
    <section id="tentang" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-transparent text-ink overflow-hidden">
      
      {/* Soft real garden backdrop with faded edges for a seamless transition */}
      <GardenArtwork
        src={GARDEN_IMAGES.scenePortrait}
        objectFit="cover"
        blur={4}
        className="absolute inset-0 w-full h-full z-0 opacity-[0.14] [mask-image:linear-gradient(to_bottom,transparent,black_18%,black_82%,transparent)]"
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-surface-base/40 to-transparent" />

      {/* Ambient background glows */}
      <StarlightGlow className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-surface-card/30" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Section Title */}
        <ScrollReveal animation="fade-up">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-card text-bloom-pink text-xs font-semibold tracking-widest uppercase mb-3 border border-bloom-pink/30">
              <span className=" h-3.5 text-gold" />
              The Secret Garden of Dreams
            </div>
            <h2 className="font-cinzel text-3xl sm:text-4xl md:text-5xl font-extrabold text-ivory tracking-wide">
              Jadwal & Panduan Undangan
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-bloom-pink to-transparent mx-auto mt-4" />
            <p className="text-sm sm:text-base text-ink/80 mt-4 leading-relaxed font-light">
              Saksikan mekarnya perjuangan, dedikasi, dan karya mahasiswa, UKM, serta Ormawa dalam panggung kehormatan Fasilkom Universitas Jember.
            </p>
          </div>
        </ScrollReveal>

        {/* 2 Philosophy Cards based on Theme */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <ScrollReveal animation="fade-right" delay={100}>
            <div className="relative p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-surface-card to-surface-base border border-bloom-pink/30 shadow-xl overflow-hidden group h-full">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-bloom-pink bg-surface-card px-3 py-1 rounded-full border border-bloom-pink/30">
                Filosofi Utama
              </span>
              <h3 className="font-cinzel text-xl sm:text-2xl font-bold text-gold mt-3 mb-2">
                The Secret Garden of Dreams
              </h3>
              <p className="text-xs sm:text-sm text-ink/80 leading-relaxed font-light">
                Melambangkan sebuah taman yang menjadi ruang bertumbuhnya mimpi, harapan, dan potensi. Layaknya bunga yang mekar melalui proses yang panjang, setiap insan menempuh perjalanan yang dipenuhi dedikasi, kerja keras, kolaborasi, serta semangat untuk terus berkembang hingga mampu meraih prestasi yang membanggakan.
              </p>
            </div>
          </ScrollReveal>

          <ScrollReveal animation="fade-left" delay={200}>
            <div className="relative p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-surface-card to-surface-base border border-bloom-pink/30 shadow-xl overflow-hidden group h-full">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-bloom-pink bg-surface-card px-3 py-1 rounded-full border border-bloom-pink/30">
                Visi & Apresiasi
              </span>
              <h3 className="font-cinzel text-xl sm:text-2xl font-bold text-gold mt-3 mb-2">
                Every Dream Blooms into History
              </h3>
              <p className="text-xs sm:text-sm text-ink/80 leading-relaxed font-light">
                Menggambarkan bahwa setiap mimpi yang diperjuangkan memiliki kesempatan berkembang menjadi pencapaian berarti. Prestasi yang diraih bukan sekadar keberhasilan sesaat, melainkan jejak sejarah yang abadi bagi individu maupun Fakultas Ilmu Komputer, menjadi inspirasi bagi lahirnya prestasi-prestasi baru.
              </p>
            </div>
          </ScrollReveal>
        </div>

        {/* 3 Main Highlights Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-20">
          
          {/* Card 1: Waktu & Tanggal */}
          <ScrollReveal animation="fade-up" delay={100}>
            <div className="bg-gradient-to-b from-surface-card/90 to-surface-card-2/90 border border-bloom-pink/25 rounded-3xl p-7 shadow-xl hover:border-bloom-pink/50 transition-all group h-full">
              <div className="w-12 h-12 rounded-2xl bg-surface-card border border-bloom-pink/40 flex items-center justify-center text-bloom-pink mb-5 group-hover:scale-110 transition-transform">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="font-cinzel text-xl font-bold text-gold mb-2">Tanggal & Waktu</h3>
              <p className="text-sm text-ink/90 font-medium">Selasa, 1 Desember 2026</p>
              <p className="text-xs text-bloom-pink mt-1 font-mono">17:30 WIB — 22:00 WIB</p>
              <p className="text-xs text-ink/60 mt-3 leading-relaxed">
                Open gate dimulai pukul 17:30 WIB. Harap hadir tepat waktu untuk registrasi & sesi red carpet.
              </p>
            </div>
          </ScrollReveal>

          {/* Card 2: Lokasi & Venue */}
          <ScrollReveal animation="fade-up" delay={200}>
            <div className="bg-gradient-to-b from-surface-card/90 to-surface-card-2/90 border border-bloom-pink/25 rounded-3xl p-7 shadow-xl hover:border-bloom-pink/50 transition-all group h-full">
              <div className="w-12 h-12 rounded-2xl bg-surface-card border border-bloom-pink/40 flex items-center justify-center text-bloom-pink mb-5 group-hover:scale-110 transition-transform">
                <MapPin className="w-6 h-6" />
              </div>
              <h3 className="font-cinzel text-xl font-bold text-gold mb-2">Lokasi & Venue</h3>
              <p className="text-sm text-ink/90 font-medium">Auditorium Gedung Biru</p>
              <p className="text-xs text-bloom-pink mt-1">Fakultas Ilmu Komputer, Universitas Jember</p>
              <p className="text-xs text-ink/60 mt-3 leading-relaxed">
                Jl. Kalimantan No. 37, Kampus Tegalboto, Sumbersari, Jember, Jawa Timur.
              </p>
            </div>
          </ScrollReveal>

          {/* Card 3: Dress Code Quick Info */}
          <ScrollReveal animation="fade-up" delay={300}>
            <div className="bg-gradient-to-b from-surface-card/90 to-surface-card-2/90 border border-bloom-pink/25 rounded-3xl p-7 shadow-xl hover:border-bloom-pink/50 transition-all group h-full">
              <div className="w-12 h-12 rounded-2xl bg-surface-card border border-lavender/40 flex items-center justify-center text-lavender mb-5 group-hover:scale-110 transition-transform">
                <Shirt className="w-6 h-6" />
              </div>
              <h3 className="font-cinzel text-xl font-bold text-gold mb-2">Kode Busana (Dress Code)</h3>
              <p className="text-sm text-ink/90 font-medium">Secret Garden Gala & Fairy Tale</p>
              <p className="text-xs text-lavender mt-1">Jas / Gaun / Batik Formal Tematik</p>
              <p className="text-xs text-ink/60 mt-3 leading-relaxed">
                Dominasi warna Deep Emerald, Starlight Gold, Fairy Pink, dan Lavender bernuansa taman magis.
              </p>
            </div>
          </ScrollReveal>

        </div>

        {/* Rundown Section — Journey Through the Garden (stepping-stone path) */}
        <div id="rundown" className="mt-20">
          <ScrollReveal animation="fade-up">
            <div className="text-center mb-16">
              <span className="text-bloom-pink font-cinzel text-xs uppercase tracking-[0.25em] font-semibold block mb-2">
                Timeline of The Night
              </span>
              <h3 className="font-cinzel text-2xl sm:text-3xl md:text-4xl font-bold text-ivory">
                Susunan Acara (Rundown)
              </h3>
              <p className="text-xs sm:text-sm text-ink/70 mt-3 font-light">
                Susuri jalan setapak taman dari gerbang pembuka hingga penutupan malam.
              </p>
            </div>
          </ScrollReveal>

          <div className="relative max-w-5xl mx-auto">
            {/* Central winding path (desktop) */}
            <div className="hidden md:block absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px bg-gradient-to-b from-transparent via-bloom-pink/40 to-transparent" />

            <div className="space-y-10 md:space-y-0">
              {rundownItems.map((item, index) => {
                const IconComponent = item.icon;
                const isLeft = index % 2 === 0;
                return (
                  <ScrollReveal key={index} animation={isLeft ? 'fade-right' : 'fade-left'} delay={index * 80}>
                    <div className="relative md:flex md:items-center md:min-h-[8rem]">
                      {/* Card side */}
                      <div className={`md:w-1/2 ${isLeft ? 'md:pr-12' : 'md:order-2 md:pl-12'}`}>
                        <div className="group relative p-5 sm:p-6 rounded-[1.75rem] bg-surface-card/85 border border-bloom-pink/25 hover:border-bloom-pink/60 hover:bg-surface-card transition-all duration-300 shadow-lg backdrop-blur-sm">
                          {/* Stepping-stone number badge */}
                          <div className="absolute -top-3 -left-3 w-9 h-9 rounded-full bg-gradient-to-br from-bloom-pink to-bloom-pink-deep text-on-accent font-cinzel font-black text-sm flex items-center justify-center shadow-[0_0_18px_rgba(255,181,232,0.5)]">
                            {index + 1}
                          </div>
                          <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-xl bg-surface-card-2 border border-bloom-pink/40 flex items-center justify-center text-bloom-pink shrink-0 group-hover:scale-110 transition-transform">
                              <IconComponent className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                                <span className="text-xs font-mono font-semibold text-gold-ink bg-gold/10 px-2.5 py-0.5 rounded-full border border-gold/30">
                                  {item.time}
                                </span>
                                <span className="text-[10px] uppercase font-semibold text-bloom-pink tracking-wider">
                                  {item.tag}
                                </span>
                              </div>
                              <h4 className="font-cinzel text-base sm:text-lg font-bold text-ivory group-hover:text-bloom-pink transition-colors">
                                {item.title}
                              </h4>
                              <p className="text-xs sm:text-sm text-ink/70 mt-1 leading-relaxed">
                                {item.desc}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Center marker (desktop) */}
                      <div className="hidden md:flex absolute left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-surface-base border-2 border-bloom-pink/50 items-center justify-center z-10 shadow-[0_0_20px_rgba(255,181,232,0.35)]">
                        <span className="font-cinzel font-black text-bloom-pink text-sm">{String(index + 1).padStart(2, '0')}</span>
                      </div>

                      {/* Empty opposite side (desktop) */}
                      <div className={`hidden md:block md:w-1/2 ${isLeft ? 'md:order-2' : ''}`} />
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dresscode Outfit Inspiration Showcase */}
        <div className="mt-24">
          <ScrollReveal animation="fade-up">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-card text-gold text-xs font-semibold tracking-widest uppercase mb-3 border border-gold/30">
                Inspirasi Busana Undangan
              </div>
              <h3 className="font-cinzel text-2xl sm:text-3xl md:text-4xl font-bold text-ivory">
                Inspirasi Dresscode: Secret Garden Gala
              </h3>
              <div className="w-20 h-1 bg-gradient-to-r from-transparent via-bloom-pink to-transparent mx-auto mt-3" />
              <p className="text-xs sm:text-sm text-ink/80 mt-3 font-light leading-relaxed">
                Rekomendasi paduan busana formal & tematik yang selaras dengan nuansa malam Secret Garden Fasilkom Awarding Night 2026.
              </p>
            </div>
          </ScrollReveal>

          <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {outfitInspirations.map((outfit, index) => (
              <ScrollReveal key={index} animation="zoom-in" delay={index * 80}>
                <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-b from-surface-card via-surface-card-2 to-surface-base border border-bloom-pink/30 hover:border-gold/80 transition-all duration-300 shadow-lg hover:-translate-y-1.5 h-full flex flex-col justify-between">
                  {/* Photo Container - Square */}
                  <div className="relative aspect-square w-full overflow-hidden bg-surface-base">
                    <Image
                      src={outfit.image}
                      alt={outfit.title}
                      fill
                      unoptimized
                      className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
                    />
                    
                    {/* Atmospheric Dark Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-surface-card-2 via-transparent to-black/30" />
                  </div>

                  {/* Description Box */}
                  <div className="p-4 relative z-10 flex-1 flex flex-col justify-between">
                    <div>
                      <h4 className="font-cinzel text-xs sm:text-sm font-bold text-ivory group-hover:text-bloom-pink transition-colors mb-1">
                        {outfit.title}
                      </h4>
                      <p className="text-[11px] text-ink/70 font-light leading-relaxed">
                        {outfit.desc}
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>

      </div>

    </section>
  );
}

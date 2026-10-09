'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, Ticket } from 'lucide-react';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-surface-base/90 backdrop-blur-md border-b border-bloom-pink/20 shadow-[0_4px_30px_rgba(0,0,0,0.5)] py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand */}
        <Link href="/" className="group flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full border border-gold/60 bg-gradient-to-br from-surface-card to-surface-card-2 flex items-center justify-center p-1.5 shadow-[0_0_15px_rgba(255,243,176,0.3)] group-hover:scale-105 transition-transform overflow-hidden">
            <Image src="/logo.png" alt="Logo FAN 2026" width={32} height={32} className="w-full h-full object-contain" />
          </div>
          <div>
            <span className="font-cinzel font-bold text-lg sm:text-xl tracking-wider text-gold block group-hover:text-bloom-pink transition-colors">
              FASILKOM
            </span>
            <span className="text-[10px] tracking-[0.25em] text-bloom-pink/80 uppercase font-sans font-medium block -mt-1">
              Awarding Night 2026
            </span>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-8 text-sm font-medium">
          <a
            href="#tentang"
            className="text-ink/80 hover:text-bloom-pink transition-colors relative py-1 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-bloom-pink hover:after:w-full after:transition-all"
          >
            Tentang Acara
          </a>
          <a
            href="#rundown"
            className="text-ink/80 hover:text-bloom-pink transition-colors relative py-1 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-bloom-pink hover:after:w-full after:transition-all"
          >
            Rundown & Venue
          </a>
          <a
            href="#insight"
            className="text-ink/80 hover:text-bloom-pink transition-colors relative py-1 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-bloom-pink hover:after:w-full after:transition-all"
          >
            Kilas Balik
          </a>
          <a
            href="#galeri"
            className="text-ink/80 hover:text-bloom-pink transition-colors relative py-1 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-bloom-pink hover:after:w-full after:transition-all"
          >
            Dokumentasi
          </a>
        </nav>

        {/* Registration CTA */}
        <div className="hidden md:flex items-center">
          <a
            href="#registrasi"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-bloom-pink to-bloom-pink-deep text-on-accent font-semibold text-sm tracking-wide shadow-[0_0_20px_rgba(255, 181, 232,0.4)] hover:shadow-[0_0_30px_rgba(255, 181, 232,0.7)] hover:scale-105 active:scale-95 transition-all"
          >
            <Ticket className="w-4 h-4" />
            Registrasi Tiket
          </a>
        </div>

        {/* Mobile menu toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-gold hover:text-bloom-pink"
          aria-label="Toggle Menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-surface-card-2/95 border-b border-bloom-pink/20 px-6 py-5 space-y-4 shadow-xl">
          <a
            href="#tentang"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-ink hover:text-bloom-pink text-base"
          >
            Tentang Acara
          </a>
          <a
            href="#rundown"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-ink hover:text-bloom-pink text-base"
          >
            Rundown & Venue
          </a>
          <a
            href="#insight"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-ink hover:text-bloom-pink text-base"
          >
            Kilas Balik
          </a>
          <a
            href="#galeri"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-ink hover:text-bloom-pink text-base"
          >
            Dokumentasi
          </a>
          <a
            href="#registrasi"
            onClick={() => setMobileMenuOpen(false)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-bloom-pink text-on-accent font-bold text-center mt-3 shadow-md"
          >
            <Ticket className="w-4 h-4" /> Ambil Undangan & Tiket
          </a>
        </div>
      )}
    </header>
  );
}

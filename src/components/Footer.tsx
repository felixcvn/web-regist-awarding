import React from 'react';
import Link from 'next/link';
import { Sparkles, Shield } from 'lucide-react';
import { BotanicalCornerFiligree } from './BotanicalDecoration';

export default function Footer() {
  return (
    <footer className="relative bg-surface-base border-t border-bloom-pink/20 text-ink py-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <BotanicalCornerFiligree position="bottom-right" className="opacity-20" />
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
          <Link
            href="/admin/scan"
            className="text-lavender hover:text-gold flex items-center gap-1 font-medium transition-colors"
          >
            <Shield className="w-3.5 h-3.5" /> Portal Panitia
          </Link>
        </div>
      </div>
    </footer>
  );
}

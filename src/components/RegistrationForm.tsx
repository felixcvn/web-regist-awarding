'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { Ticket, User, Mail, Phone, BookOpen, AlertCircle, CheckCircle, Loader2, ChevronDown, Check, Users, CalendarDays } from 'lucide-react';
import { RoleType, CategoryType, BatchType, CATEGORY_OPTIONS, BATCH_OPTIONS } from '@/lib/types';
import { StarlightGlow, BotanicalCornerFiligree } from './BotanicalDecoration';
import ScrollReveal from './ScrollReveal';

type DropdownKey = 'prodi' | 'category' | 'batch';

export default function RegistrationForm() {
  const router = useRouter();

  const [formData, setFormData] = useState({
    name: '',
    role: 'Mahasiswa' as RoleType,
    nimNip: '',
    category: 'HIMASIF' as CategoryType,
    batch: '-' as BatchType,
    prodi: 'Informatika',
    email: '',
    phone: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [nimError, setNimError] = useState('');
  const [checkingNim, setCheckingNim] = useState(false);
  const [success, setSuccess] = useState(false);

  const [openDropdown, setOpenDropdown] = useState<DropdownKey | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!(e.target as Element).closest('[data-dropdown]')) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const prodiOptions = [
    'Informatika',
    'Sistem Informasi',
    'Teknologi Informasi',
  ];

  const isStudentBatch = formData.category === 'Mahasiswa Fasilkom' || formData.category === 'Perwakilan Angkatan';

  const prodiFromNim = (nim: string): string | null => {
    const digits = nim.replace(/\D/g, '');
    if (digits.length < 4) return null;
    const last4 = digits.slice(-4);
    if (last4.startsWith('10')) return 'Sistem Informasi';
    if (last4.startsWith('20')) return 'Teknologi Informasi';
    if (last4.startsWith('30')) return 'Informatika';
    return null;
  };

  useEffect(() => {
    const nim = formData.nimNip.trim();
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!nim) {
        setNimError('');
        setCheckingNim(false);
        return;
      }
      setCheckingNim(true);

      const detectedProdi = prodiFromNim(nim);
      if (detectedProdi) {
        setFormData((prev) => (prev.prodi === detectedProdi ? prev : { ...prev, prodi: detectedProdi }));
      }

      try {
        const res = await fetch(`/api/register/check?nim=${encodeURIComponent(nim)}`);
        const data = await res.json();
        if (cancelled) return;
        setNimError(data.available === false ? 'NIM ini sudah terdaftar. Satu NIM hanya untuk satu registrasi.' : '');
      } catch {
        if (!cancelled) setNimError('');
      } finally {
        if (!cancelled) setCheckingNim(false);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.nimNip]);

  const toggleDropdown = (key: DropdownKey) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (nimError) {
      setErrorMsg(nimError);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mendaftar. Silakan coba lagi.');
      }

      setSuccess(true);
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#AFF8DB', '#FFF3B0', '#FFB5E8', '#E7C6FF'],
      });

      setTimeout(() => {
        router.push(data.ticketUrl || `/ticket/${data.participant.qrToken}`);
      }, 1200);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  const dropdownClass = (key: DropdownKey) =>
    `w-full flex items-center justify-between pl-11 pr-4 py-3.5 rounded-xl bg-[#071A13] border text-sm text-[#FAF7F0] transition-all cursor-pointer text-left ${
      openDropdown === key
        ? 'border-[#AFF8DB] ring-2 ring-[#AFF8DB]/20 shadow-[0_0_15px_rgba(175,248,219,0.2)]'
        : 'border-[#AFF8DB]/30 hover:border-[#AFF8DB]/60'
    }`;

  const optionClass = (selected: boolean) =>
    `w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-all cursor-pointer ${
      selected
        ? 'bg-[#AFF8DB]/20 text-[#AFF8DB] font-semibold pl-5 border-l-4 border-[#AFF8DB]'
        : 'text-[#EDE8DF]/90 hover:bg-[#AFF8DB]/10 hover:text-[#FAF7F0]'
    }`;

  return (
    <section id="registrasi" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-[#061510] text-[#EDE8DF] overflow-hidden">
      
      {/* Botanical corner filigrees */}
      <BotanicalCornerFiligree position="bottom-left" className="opacity-45" />
      <BotanicalCornerFiligree position="bottom-right" className="opacity-45" />

      {/* Ambient Starlight Glows */}
      <StarlightGlow className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-[#AFF8DB]/15" />
      <StarlightGlow className="absolute -bottom-16 -left-16 w-80 h-80 bg-[#FFF3B0]/10" />
      <StarlightGlow className="absolute -bottom-16 -right-16 w-80 h-80 bg-[#FFB5E8]/10" />

      <div className="max-w-3xl mx-auto relative z-20">
        
        {/* Title Header */}
        <ScrollReveal animation="fade-up">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#12382B] text-[#AFF8DB] text-xs font-semibold tracking-widest uppercase mb-3 border border-[#AFF8DB]/30 shadow-md">
              Gerbang Secret Garden
            </div>
            <h2 className="font-cinzel text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#FAF7F0] tracking-wide">
              Konfirmasi Kehadiran
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-[#AFF8DB] to-transparent mx-auto mt-4" />
            <p className="text-xs sm:text-sm text-[#EDE8DF]/80 mt-4 leading-relaxed font-light">
              Jadilah saksi lahirnya sejarah baru. Lengkapi data diri Anda untuk mendapatkan Tiket Masuk Resmi & QR Code kehadiran.
            </p>
          </div>
        </ScrollReveal>

        {/* Card Form */}
        <ScrollReveal animation="zoom-in" delay={150}>
          <div className="relative rounded-3xl p-6 sm:p-10 bg-gradient-to-b from-[#0E2A20]/95 via-[#0A1F18]/95 to-[#061510]/95 border border-[#AFF8DB]/30 shadow-[0_0_50px_rgba(6,21,16,0.9)] backdrop-blur-md">
            
            {errorMsg && (
            <div className="mb-6 p-4 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs sm:text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-2xl bg-[#144234]/90 border border-[#AFF8DB]/60 text-[#AFF8DB] text-xs sm:text-sm flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-[#AFF8DB] shrink-0 animate-bounce" />
              <span>Pendaftaran berhasil! Mengalihkan ke Tiket Digital Anda...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Nama Lengkap */}
            <div>
              <label className="block text-xs uppercase tracking-widest text-[#FFF3B0] font-semibold mb-2">
                Nama Lengkap Mahasiswa <span className="text-[#FFB5E8]">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AFF8DB]" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: Arya Yudhistira"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-[#071A13] border border-[#AFF8DB]/30 focus:border-[#AFF8DB] focus:ring-2 focus:ring-[#AFF8DB]/20 text-sm text-[#FAF7F0] placeholder-[#EDE8DF]/40 outline-hidden transition-all"
                />
              </div>
            </div>

            {/* NIM */}
            <div>
              <label className="block text-xs uppercase tracking-widest text-[#FFF3B0] font-semibold mb-2">
                Nomor Induk Mahasiswa (NIM) <span className="text-[#FFB5E8]">*</span>
              </label>
              <div className="relative">
                <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AFF8DB]" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: 232410101055"
                  value={formData.nimNip}
                  onChange={(e) => setFormData({ ...formData, nimNip: e.target.value })}
                  className={`w-full pl-11 pr-10 py-3.5 rounded-xl bg-[#071A13] border text-sm text-[#FAF7F0] placeholder-[#EDE8DF]/40 outline-hidden transition-all font-mono ${
                    nimError ? 'border-red-500/70 focus:border-red-500 focus:ring-2 focus:ring-red-500/20' : 'border-[#AFF8DB]/30 focus:border-[#AFF8DB] focus:ring-2 focus:ring-[#AFF8DB]/20'
                  }`}
                />
                {checkingNim && (
                  <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AFF8DB] animate-spin" />
                )}
              </div>
              {nimError && (
                <p className="mt-2 text-[11px] text-red-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {nimError}
                </p>
              )}
            </div>

            {/* Kategori Civitas & Angkatan Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative" data-dropdown>
                <label className="block text-xs uppercase tracking-widest text-[#FFF3B0] font-semibold mb-2">
                  Datang Sebagai <span className="text-[#FFB5E8]">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => toggleDropdown('category')}
                    aria-haspopup="listbox"
                    aria-expanded={openDropdown === 'category'}
                    className={dropdownClass('category')}
                  >
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AFF8DB]" />
                    <span className="truncate">{formData.category}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#AFF8DB] transition-transform duration-200 shrink-0 ml-2 ${
                        openDropdown === 'category' ? 'rotate-180 text-[#FFF3B0]' : ''
                      }`}
                    />
                  </button>

                  {openDropdown === 'category' && (
                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 py-1.5 rounded-2xl bg-[#082017]/95 backdrop-blur-xl border border-[#AFF8DB]/40 shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-y-auto max-h-64">
                      <div className="divide-y divide-[#AFF8DB]/10">
                        {CATEGORY_OPTIONS.map((c) => {
                          const isSelected = formData.category === c;
                          return (
                            <button
                              key={c}
                              type="button"
                                onClick={() => {
                                  const keepsBatch = c === 'Mahasiswa Fasilkom' || c === 'Perwakilan Angkatan';
                                  setFormData({ ...formData, category: c, batch: keepsBatch ? formData.batch : '-' });
                                  setOpenDropdown(null);
                                }}
                              className={optionClass(isSelected)}
                            >
                              <span className="truncate">{c}</span>
                              {isSelected && <Check className="w-4 h-4 text-[#AFF8DB] shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative" data-dropdown>
                <label className="block text-xs uppercase tracking-widest text-[#FFF3B0] font-semibold mb-2">
                  Angkatan {isStudentBatch && <span className="text-[#FFB5E8]">*</span>}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    disabled={!isStudentBatch}
                    onClick={() => toggleDropdown('batch')}
                    aria-haspopup="listbox"
                    aria-expanded={openDropdown === 'batch'}
                    className={`${dropdownClass('batch')} disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AFF8DB]" />
                    <span className="truncate">{isStudentBatch ? formData.batch : '—'}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#AFF8DB] transition-transform duration-200 shrink-0 ml-2 ${
                        openDropdown === 'batch' ? 'rotate-180 text-[#FFF3B0]' : ''
                      }`}
                    />
                  </button>

                  {openDropdown === 'batch' && isStudentBatch && (
                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 py-1.5 rounded-2xl bg-[#082017]/95 backdrop-blur-xl border border-[#AFF8DB]/40 shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-y-auto max-h-64">
                      <div className="divide-y divide-[#AFF8DB]/10">
                        {BATCH_OPTIONS.map((b) => {
                          const isSelected = formData.batch === b;
                          return (
                            <button
                              key={b}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, batch: b });
                                setOpenDropdown(null);
                              }}
                              className={optionClass(isSelected)}
                            >
                              <span className="truncate">{b}</span>
                              {isSelected && <Check className="w-4 h-4 text-[#AFF8DB] shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Program Studi */}
            <div className="relative" data-dropdown>
              <label className="block text-xs uppercase tracking-widest text-[#FFF3B0] font-semibold mb-2">
                Program Studi (S1) <span className="text-[#FFB5E8]">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown('prodi')}
                  aria-haspopup="listbox"
                  aria-expanded={openDropdown === 'prodi'}
                  className={dropdownClass('prodi')}
                >
                  <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AFF8DB]" />
                  <span className="truncate">{formData.prodi}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#AFF8DB] transition-transform duration-200 shrink-0 ml-2 ${
                      openDropdown === 'prodi' ? 'rotate-180 text-[#FFF3B0]' : ''
                    }`}
                  />
                </button>

                {openDropdown === 'prodi' && (
                  <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 py-1.5 rounded-2xl bg-[#082017]/95 backdrop-blur-xl border border-[#AFF8DB]/40 shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-y-auto max-h-64">
                    <div className="divide-y divide-[#AFF8DB]/10">
                      {prodiOptions.map((p) => {
                        const isSelected = formData.prodi === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, prodi: p });
                              setOpenDropdown(null);
                            }}
                            className={optionClass(isSelected)}
                          >
                            <span className="truncate">{p}</span>
                            {isSelected && <Check className="w-4 h-4 text-[#AFF8DB] shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Email & Phone Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs uppercase tracking-widest text-[#FFF3B0] font-semibold mb-2">
                  Email Aktif <span className="text-[#FFB5E8]">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AFF8DB]" />
                  <input
                    type="email"
                    required
                    placeholder="nama@mail.unej.ac.id"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-[#071A13] border border-[#AFF8DB]/30 focus:border-[#AFF8DB] focus:ring-2 focus:ring-[#AFF8DB]/20 text-sm text-[#FAF7F0] placeholder-[#EDE8DF]/40 outline-hidden transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-[#FFF3B0] font-semibold mb-2">
                  No. WhatsApp (Untuk Konfirmasi)
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#AFF8DB]" />
                  <input
                    type="tel"
                    placeholder="081234567890"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-[#071A13] border border-[#AFF8DB]/30 focus:border-[#AFF8DB] focus:ring-2 focus:ring-[#AFF8DB]/20 text-sm text-[#FAF7F0] placeholder-[#EDE8DF]/40 outline-hidden transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || success || !!nimError}
                className="w-full py-4 px-6 rounded-2xl bg-[#AFF8DB] hover:bg-[#86efc3] text-[#061811] font-bold text-base tracking-wide shadow-[0_0_30px_rgba(175,248,219,0.6)] hover:shadow-[0_0_45px_rgba(175,248,219,0.9)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-[#061811]" />
                    Sedang Memproses Tiket...
                  </>
                ) : (
                  <>
                    Daftar & Terbitkan Tiket Masuk
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-center text-[#EDE8DF]/50 mt-3">
              Dengan mendaftar, Anda menyatakan kesediaan hadir pada perhelatan Fasilkom Awarding Night 2026.
            </p>
          </form>
        </div>
      </ScrollReveal>

      </div>
    </section>
  );
}

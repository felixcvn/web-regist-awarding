'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import confetti from 'canvas-confetti';
import { Ticket, User, Mail, Phone, BookOpen, AlertCircle, CheckCircle, Loader2, ChevronDown, Check, X, Users, CalendarDays } from 'lucide-react';
import { RoleType, CategoryType, BatchType, CATEGORY_OPTIONS, BATCH_OPTIONS } from '@/lib/types';
import { StarlightGlow } from './StarlightGlow';
import ScrollReveal from './ScrollReveal';

declare global {
  interface Window {
    turnstile?: { reset: () => void };
  }
}

type DropdownKey = 'prodi' | 'category' | 'batch';
type IdentityStatus = 'idle' | 'checking' | 'valid' | 'invalid' | 'unavailable';

function IdentityIndicator({ status, field }: { status: IdentityStatus; field: 'name' | 'nim' }) {
  if (status === 'idle') return null;

  const message = status === 'valid'
    ? 'Nama dan NIM cocok dengan data mahasiswa aktif.'
    : status === 'invalid'
      ? 'Nama atau NIM tidak sesuai. Periksa kembali ejaan nama dan nomor NIM.'
      : status === 'checking'
        ? 'Sedang mencocokkan nama dan NIM dengan data mahasiswa aktif.'
        : 'Validasi belum tersedia. Coba lagi beberapa saat.';

  return (
    <button
      type="button"
      aria-label={message}
      aria-describedby={`${field}-identity-tooltip`}
      className={`group absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 outline-none focus-visible:ring-2 focus-visible:ring-ivory ${
        status === 'valid' ? 'text-mint' : status === 'invalid' ? 'text-red-400' : status === 'unavailable' ? 'text-gold' : 'text-bloom-pink'
      }`}
    >
      {status === 'valid' ? <CheckCircle className="h-5 w-5" /> : null}
      {status === 'invalid' ? <X className="h-5 w-5" /> : null}
      {status === 'checking' ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
      {status === 'unavailable' ? <AlertCircle className="h-5 w-5" /> : null}
      <span
        id={`${field}-identity-tooltip`}
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-50 mb-2 w-64 rounded-lg border border-bloom-pink/30 bg-surface-base px-3 py-2 text-left text-xs font-medium leading-relaxed text-ivory opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      >
        {message}
      </span>
    </button>
  );
}

export default function RegistrationForm() {
  const router = useRouter();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const [formData, setFormData] = useState({
    name: '',
    role: 'Mahasiswa' as RoleType,
    nimNip: '',
    category: '' as CategoryType,
    batch: '-' as BatchType,
    prodi: '',
    email: '',
    phone: '',
    // Honeypot: invisible to humans, filled by naive bots.
    website: '',
  });

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [nimError, setNimError] = useState('');
  const [success, setSuccess] = useState(false);
  const [identityCheck, setIdentityCheck] = useState<{ key: string; status: IdentityStatus }>({ key: '', status: 'idle' });

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

  const normalizedIdentityKey = `${formData.nimNip.trim()}|${formData.name.trim().replace(/\s+/g, ' ').normalize('NFKC').toLocaleLowerCase('id-ID')}`;
  const hasIdentityInputs = Boolean(formData.nimNip.trim() && formData.name.trim());
  const identityStatus: IdentityStatus = identityCheck.key === normalizedIdentityKey
    ? identityCheck.status
    : hasIdentityInputs ? 'checking' : 'idle';

  const prodiFromNim = (nim: string): string | null => {
    const digits = nim.replace(/\D/g, '');
    if (digits.length < 4) return null;
    const last4 = digits.slice(-4);
    if (last4.startsWith('10')) return 'Sistem Informasi';
    if (last4.startsWith('20')) return 'Teknologi Informasi';
    if (last4.startsWith('30')) return 'Informatika';
    return null;
  };

  const batchFromNim = (nim: string): BatchType => {
    const year = nim.trim().slice(0, 2);
    return ['23', '24', '25', '26'].includes(year) ? (`20${year}` as BatchType) : '-';
  };

  useEffect(() => {
    const nim = formData.nimNip.trim();
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (!nim) {
        setNimError('');
        return;
      }

      const detectedProdi = prodiFromNim(nim);
      const detectedBatch = batchFromNim(nim);
      setFormData((prev) => (
        prev.prodi === (detectedProdi || '') && prev.batch === detectedBatch
          ? prev
          : { ...prev, prodi: detectedProdi || '', batch: detectedBatch }
      ));

      try {
        const res = await fetch(`/api/register/check?nim=${encodeURIComponent(nim)}`);
        const data = await res.json();
        if (cancelled) return;
        setNimError(data.available === false ? 'NIM ini sudah terdaftar. Satu NIM hanya untuk satu registrasi.' : '');
      } catch {
        if (!cancelled) setNimError('');
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.nimNip]);

  useEffect(() => {
    const nim = formData.nimNip.trim();
    const name = formData.name.trim();
    const identityKey = normalizedIdentityKey;
    if (!nim || !name) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIdentityCheck({ key: identityKey, status: 'checking' });
      try {
        const response = await fetch('/api/register/validate-identity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nim, name }),
        });
        const data = await response.json();
        if (cancelled) return;
        setIdentityCheck({
          key: identityKey,
          status: response.status === 503 ? 'unavailable' : data.valid ? 'valid' : 'invalid',
        });
      } catch {
        if (!cancelled) setIdentityCheck({ key: identityKey, status: 'unavailable' });
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [formData.name, formData.nimNip, normalizedIdentityKey]);

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

    if (identityStatus !== 'valid' || identityCheck.key !== normalizedIdentityKey) {
      setErrorMsg(identityStatus === 'unavailable'
        ? 'Data mahasiswa belum dapat diperiksa. Silakan coba lagi.'
        : 'Pastikan nama dan NIM sudah cocok dengan data mahasiswa aktif.');
      return;
    }

    if (!formData.category) {
      setErrorMsg('Silakan pilih datang sebagai apa terlebih dahulu.');
      return;
    }

    if (!formData.prodi) {
      setErrorMsg('Silakan pilih program studi Anda terlebih dahulu.');
      return;
    }

    const turnstileToken = turnstileSiteKey
      ? (document.querySelector('[name="cf-turnstile-response"]') as HTMLInputElement | null)?.value || ''
      : '';

    if (turnstileSiteKey && !turnstileToken) {
      setErrorMsg('Selesaikan verifikasi anti-bot terlebih dahulu.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, turnstileToken }),
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
        colors: ['#FFB5E8', '#FFF3B0', '#AFF8DB', '#E7C6FF'],
      });

      setTimeout(() => {
        router.push(data.ticketUrl || `/ticket/${data.participant.qrToken}`);
      }, 1200);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan.');
      // Turnstile tokens are single-use; refresh the widget for the next attempt.
      window.turnstile?.reset();
    } finally {
      setLoading(false);
    }
  };

  const dropdownClass = (key: DropdownKey) =>
    `w-full flex items-center justify-between pl-11 pr-4 py-3.5 rounded-xl bg-surface-card-2 border text-sm text-ivory transition-all cursor-pointer text-left ${
      openDropdown === key
        ? 'border-bloom-pink ring-2 ring-bloom-pink/20 shadow-[0_0_15px_rgba(255, 181, 232,0.2)]'
        : 'border-bloom-pink/30 hover:border-bloom-pink/60'
    }`;

  const optionClass = (selected: boolean) =>
    `w-full flex items-center justify-between px-4 py-3 text-sm text-left transition-all cursor-pointer ${
      selected
        ? 'bg-bloom-pink/20 text-bloom-pink font-semibold pl-5 border-l-4 border-bloom-pink'
        : 'text-ink/90 hover:bg-bloom-pink/10 hover:text-ivory'
    }`;

  return (
    <section id="registrasi" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-transparent text-ink overflow-hidden">

      {/* Ambient Starlight Glows */}
      <StarlightGlow className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-surface-card/30" />

      <div className="max-w-3xl mx-auto relative z-20">
        
        {/* Title Header */}
        <ScrollReveal animation="fade-up">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-card text-bloom-pink text-xs font-semibold tracking-widest uppercase mb-3 border border-bloom-pink/30 shadow-md">
              Gerbang Secret Garden
            </div>
            <h2 className="font-cinzel text-3xl sm:text-4xl md:text-5xl font-extrabold text-ivory tracking-wide">
              Konfirmasi Kehadiran
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-bloom-pink to-transparent mx-auto mt-4" />
            <p className="text-xs sm:text-sm text-ink/80 mt-4 leading-relaxed font-light">
              Jadilah saksi lahirnya sejarah baru. Lengkapi data diri Anda untuk mendapatkan Tiket Masuk Resmi & QR Code kehadiran.
            </p>
          </div>
        </ScrollReveal>

        {/* Card Form — framed as the Secret Gate */}
        <ScrollReveal animation="zoom-in" delay={150}>
          <div className="relative">
            {/* gate arch crown */}
            <div className="relative mx-auto max-w-lg">
              <div className="h-16 rounded-t-[50%] border-x-2 border-t-2 border-bloom-pink/40 bg-gradient-to-b from-surface-card/60 to-transparent" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-gradient-to-br from-gold to-bloom-pink-deep shadow-[0_0_16px_rgba(255,181,232,0.7)]" />
            </div>

            <div className="relative -mt-2 rounded-3xl p-6 sm:p-10 bg-gradient-to-b from-surface-card/95 via-surface-card-2/95 to-surface-base/95 border border-bloom-pink/30 shadow-[0_0_50px_rgba(12,6,18,0.9)] backdrop-blur-md">
              {/* inner arch hairline */}
              <div className="pointer-events-none absolute inset-3 rounded-[1.75rem] border border-bloom-pink/15" />
            {errorMsg && (
            <div className="mb-6 p-4 rounded-2xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs sm:text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 rounded-2xl bg-surface-card/90 border border-bloom-pink/60 text-bloom-pink text-xs sm:text-sm flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-bloom-pink shrink-0 animate-bounce" />
              <span>Pendaftaran berhasil! Mengalihkan ke Tiket Digital Anda...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Honeypot (anti-bot) — hidden from real users */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
              <label htmlFor="website">Website</label>
              <input
                id="website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              />
            </div>
            
            <div className="space-y-5">
            {/* Nama Lengkap */}
            <div>
              <label className="block text-xs uppercase tracking-widest text-gold font-semibold mb-2">
                Nama Lengkap Mahasiswa <span className="text-bloom-pink">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bloom-pink" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: Arya Yudhistira"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`w-full pl-11 pr-11 py-3.5 rounded-xl bg-surface-card-2 border text-sm text-ivory placeholder-ink/40 outline-hidden transition-all ${
                    identityStatus === 'valid'
                      ? 'border-mint/70 focus:border-mint focus:ring-2 focus:ring-mint/20'
                      : identityStatus === 'invalid'
                        ? 'border-red-500/70 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                        : 'border-bloom-pink/30 focus:border-bloom-pink focus:ring-2 focus:ring-bloom-pink/20'
                  }`}
                />
                <IdentityIndicator status={identityStatus} field="name" />
              </div>
            </div>

            {/* NIM */}
            <div>
              <label className="block text-xs uppercase tracking-widest text-gold font-semibold mb-2">
                Nomor Induk Mahasiswa (NIM) <span className="text-bloom-pink">*</span>
              </label>
              <div className="relative">
                <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bloom-pink" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: 232410101055"
                  value={formData.nimNip}
                  onChange={(e) => {
                    setNimError('');
                    setFormData({ ...formData, nimNip: e.target.value });
                  }}
                  className={`w-full pl-11 pr-11 py-3.5 rounded-xl bg-surface-card-2 border text-sm text-ivory placeholder-ink/40 outline-hidden transition-all font-mono ${
                    identityStatus === 'valid'
                      ? 'border-mint/70 focus:border-mint focus:ring-2 focus:ring-mint/20'
                      : identityStatus === 'invalid'
                        ? 'border-red-500/70 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                        : nimError
                          ? 'border-red-500/70 focus:border-red-500 focus:ring-2 focus:ring-red-500/20'
                          : 'border-bloom-pink/30 focus:border-bloom-pink focus:ring-2 focus:ring-bloom-pink/20'
                  }`}
                />
                <IdentityIndicator status={identityStatus} field="nim" />
              </div>
              {nimError && (
                <p className="mt-2 text-[11px] text-red-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {nimError}
                </p>
              )}
            </div>

            </div>
            <span aria-live="polite" className="sr-only">
              {identityStatus === 'valid' ? 'Nama dan NIM cocok.' : identityStatus === 'invalid' ? 'Nama dan NIM tidak cocok.' : identityStatus === 'checking' ? 'Memeriksa nama dan NIM.' : identityStatus === 'unavailable' ? 'Pemeriksaan data mahasiswa belum tersedia.' : ''}
            </span>

            {/* Kategori Civitas & Angkatan Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative" data-dropdown>
                <label className="mb-2 block text-xs uppercase tracking-widest text-gold font-semibold">
                  Datang Sebagai <span className="text-bloom-pink">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => toggleDropdown('category')}
                    aria-haspopup="listbox"
                    aria-expanded={openDropdown === 'category'}
                    className={dropdownClass('category')}
                  >
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bloom-pink" />
                    <span className={`truncate ${formData.category ? '' : 'text-ink/40'}`}>
                      {formData.category || 'Pilih Datang Sebagai...'}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-bloom-pink transition-transform duration-200 shrink-0 ml-2 ${
                        openDropdown === 'category' ? 'rotate-180 text-gold' : ''
                      }`}
                    />
                  </button>

                  {openDropdown === 'category' && (
                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 py-1.5 rounded-2xl bg-surface-card-2/95 backdrop-blur-xl border border-bloom-pink/40 shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-y-auto max-h-64">
                      <div className="divide-y divide-bloom-pink/10">
                        {CATEGORY_OPTIONS.map((c) => {
                          const isSelected = formData.category === c;
                          return (
                            <button
                              key={c}
                              type="button"
                              onClick={() => {
                                setFormData((prev) => ({ ...prev, category: c }));
                                setOpenDropdown(null);
                              }}
                              className={optionClass(isSelected)}
                            >
                              <span className="truncate">{c}</span>
                              {isSelected && <Check className="w-4 h-4 text-bloom-pink shrink-0 ml-2" />}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative" data-dropdown>
                <label className="mb-2 block text-xs uppercase tracking-widest text-gold font-semibold">
                  Angkatan <span className="text-bloom-pink">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => toggleDropdown('batch')}
                    aria-haspopup="listbox"
                    aria-expanded={openDropdown === 'batch'}
                    className={dropdownClass('batch')}
                  >
                    <CalendarDays className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bloom-pink" />
                    <span className={`truncate ${formData.batch === '-' ? 'text-ink/40' : ''}`}>
                      {formData.batch === '-' ? 'Pilih Angkatan...' : formData.batch}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-bloom-pink transition-transform duration-200 shrink-0 ml-2 ${
                        openDropdown === 'batch' ? 'rotate-180 text-gold' : ''
                      }`}
                    />
                  </button>

                  {openDropdown === 'batch' && (
                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 py-1.5 rounded-2xl bg-surface-card-2/95 backdrop-blur-xl border border-bloom-pink/40 shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-y-auto max-h-64">
                      <div className="divide-y divide-bloom-pink/10">
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
                              {isSelected && <Check className="w-4 h-4 text-bloom-pink shrink-0 ml-2" />}
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
              <label className="mb-2 block text-xs uppercase tracking-widest text-gold font-semibold">
                Program Studi (S1) <span className="text-bloom-pink">*</span>
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown('prodi')}
                  aria-haspopup="listbox"
                  aria-expanded={openDropdown === 'prodi'}
                  className={dropdownClass('prodi')}
                >
                  <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bloom-pink" />
                  <span className={`truncate ${formData.prodi ? '' : 'text-ink/40'}`}>
                    {formData.prodi || 'Pilih Program Studi Yang Ada...'}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-bloom-pink transition-transform duration-200 shrink-0 ml-2 ${
                      openDropdown === 'prodi' ? 'rotate-180 text-gold' : ''
                    }`}
                  />
                </button>

                {openDropdown === 'prodi' && (
                  <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 py-1.5 rounded-2xl bg-surface-card-2/95 backdrop-blur-xl border border-bloom-pink/40 shadow-[0_12px_40px_rgba(0,0,0,0.8)] overflow-y-auto max-h-64">
                    <div className="divide-y divide-bloom-pink/10">
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
                            {isSelected && <Check className="w-4 h-4 text-bloom-pink shrink-0 ml-2" />}
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
                <label className="block text-xs uppercase tracking-widest text-gold font-semibold mb-2">
                  Email Aktif <span className="text-bloom-pink">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bloom-pink" />
                  <input
                    type="email"
                    required
                    placeholder="nama@mail.unej.ac.id"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-surface-card-2 border border-bloom-pink/30 focus:border-bloom-pink focus:ring-2 focus:ring-bloom-pink/20 text-sm text-ivory placeholder-ink/40 outline-hidden transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-gold font-semibold mb-2">
                  No. WhatsApp (Untuk Konfirmasi)
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bloom-pink" />
                  <input
                    type="tel"
                    placeholder="081234567890"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-surface-card-2 border border-bloom-pink/30 focus:border-bloom-pink focus:ring-2 focus:ring-bloom-pink/20 text-sm text-ivory placeholder-ink/40 outline-hidden transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Cloudflare Turnstile — only rendered when the site key is configured */}
            {turnstileSiteKey && (
              <div className="flex flex-col items-center gap-2">
                <Script
                  src="https://challenges.cloudflare.com/turnstile/v0/api.js"
                  strategy="lazyOnload"
                />
                <div
                  className="cf-turnstile"
                  data-sitekey={turnstileSiteKey}
                  data-theme="dark"
                />
                <span className="text-[10px] text-ink/50">
                  Dilindungi oleh Cloudflare Turnstile
                </span>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={loading || success || !!nimError}
                className="w-full py-4 px-6 rounded-2xl bg-bloom-pink hover:bg-bloom-pink-deep text-on-accent font-bold text-base tracking-wide shadow-[0_0_30px_rgba(255, 181, 232,0.6)] hover:shadow-[0_0_45px_rgba(255, 181, 232,0.9)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-on-accent" />
                    Sedang Memproses Tiket...
                  </>
                ) : (
                  <>
                    Daftar & Terbitkan Tiket Masuk
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-center text-ink/50 mt-3">
              Dengan mendaftar, Anda menyatakan kesediaan hadir pada perhelatan Fasilkom Awarding Night 2026.
            </p>
          </form>
            </div>
          </div>
        </ScrollReveal>

      </div>
    </section>
  );
}

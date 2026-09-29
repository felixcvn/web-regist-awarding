'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, KeyRound, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'PIN Panitia salah!');
      }

      router.push('/admin/dashboard');
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-garden bg-vignette-soft text-ink flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full">
        
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-bloom-pink hover:text-gold mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Halaman Utama
        </Link>

        <div className="rounded-3xl p-8 bg-gradient-to-b from-surface-card to-surface-base border border-bloom-pink/30 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-surface-card border border-bloom-pink/40 text-bloom-pink flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(175,248,219,0.3)]">
              <Shield className="w-7 h-7" />
            </div>
            <h1 className="font-cinzel text-2xl font-bold text-ivory">
              Portal Panitia FAN 2026
            </h1>
            <p className="text-xs text-ink/70 mt-1">
              Masukkan PIN Panitia untuk membuka Scanner & Dashboard
            </p>
          </div>

          {errorMsg && (
            <div className="mb-6 p-3.5 rounded-xl bg-red-950/80 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs uppercase tracking-widest text-gold font-semibold mb-2">
                PIN Akses Panitia
              </label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bloom-pink" />
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Masukkan 4 digit PIN..."
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-field border border-bloom-pink/30 focus:border-bloom-pink focus:ring-2 focus:ring-bloom-pink/20 text-sm text-ivory placeholder-ink/40 outline-hidden tracking-widest text-center font-mono font-bold"
                />
              </div>
              <p className="text-[11px] text-ink/50 mt-2 text-center">
                PIN Default pengujian: <span className="font-mono text-bloom-pink">2026</span>
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-bloom-pink to-bloom-pink-deep text-on-accent font-bold text-sm tracking-wide shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                'Buka Akses Panitia'
              )}
            </button>
          </form>
        </div>

      </div>
    </main>
  );
}

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, AlertCircle, Loader2, UtensilsCrossed } from 'lucide-react';
import { secureFetch } from '@/lib/csrfClient';
import { isOrderingSettings, isTallyFormUrl, type OrderingSettings, type OrderingSettingsUpdate } from '@/lib/orderingSettings';

export default function OrderingSettingsPanel() {
  const router = useRouter();
  const [settings, setSettings] = useState<OrderingSettings | null>(null);
  const [draftUrl, setDraftUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'visibility' | 'link' | null>(null);
  const [feedback, setFeedback] = useState<{ error: boolean; message: string } | null>(null);

  const loadSettings = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setFeedback(null);
    try {
      const timeout = AbortSignal.timeout(20_000);
      const response = await fetch('/api/admin/ordering', { cache: 'no-store', signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
      if (response.status === 401) {
        router.replace('/admin/login');
        return;
      }
      const data = await response.json();
      if (!response.ok || !isOrderingSettings(data)) throw new Error('Pengaturan Pemesanan belum dapat dimuat. Coba lagi.');
      if (signal?.aborted) return;
      setSettings(data);
      setDraftUrl(data.tallyUrl);
    } catch {
      if (!signal?.aborted) setFeedback({ error: true, message: 'Pengaturan Pemesanan belum dapat dimuat. Coba lagi.' });
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadSettings(controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [loadSettings]);

  const saveSettings = async (update: OrderingSettingsUpdate, kind: 'visibility' | 'link') => {
    if (!settings || loading || saving) return;
    setSaving(kind);
    setFeedback(null);
    try {
      const response = await secureFetch('/api/admin/ordering', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
        signal: AbortSignal.timeout(20_000),
      });
      if (response.status === 401) {
        router.replace('/admin/login');
        return;
      }
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Pengaturan belum berhasil disimpan. Coba lagi.');
      if (!isOrderingSettings(data)) throw new Error('Hasil penyimpanan belum dapat dikonfirmasi. Muat ulang halaman.');
      setSettings(data);
      if (kind === 'link') setDraftUrl(data.tallyUrl);
      setFeedback({
        error: false,
        message: kind === 'visibility'
          ? data.visible ? 'Menu Pemesanan ditampilkan untuk pengunjung.' : 'Menu Pemesanan disembunyikan dari pengunjung.'
          : data.tallyUrl ? 'Link Tally tersimpan. Menu Pemesanan akan membuka form di tab baru.' : 'Link dikosongkan. Menu Pemesanan kembali menampilkan pop-up segera tersedia.',
      });
    } catch (error) {
      setFeedback({ error: true, message: error instanceof Error && error.name === 'Error' ? error.message : 'Koneksi gagal. Perubahan belum terkonfirmasi; coba lagi atau muat ulang halaman.' });
    } finally {
      setSaving(null);
    }
  };

  const handleSaveLink = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const tallyUrl = draftUrl.trim();
    if (tallyUrl && !isTallyFormUrl(tallyUrl)) {
      setFeedback({ error: true, message: 'Gunakan link form Tally dengan format https://tally.so/r/… atau kosongkan link.' });
      return;
    }
    void saveSettings({ tallyUrl }, 'link');
  };

  const disabled = loading || !!saving || !settings;

  return (
    <section aria-labelledby="ordering-settings-title" className="rounded-3xl p-5 sm:p-6 bg-gradient-to-b from-surface-card to-surface-card-2 border border-bloom-pink/25">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 text-gold" aria-hidden="true">
            <UtensilsCrossed className="h-5 w-5" />
          </div>
          <div>
            <h2 id="ordering-settings-title" className="text-base sm:text-lg font-bold text-ivory">Menu Pemesanan</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink/70">Pemesanan makanan dan minuman untuk hari acara.</p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings?.visible ?? false}
          aria-labelledby="ordering-visibility-label"
          aria-busy={loading || saving === 'visibility'}
          disabled={disabled}
          onClick={() => settings && void saveSettings({ visible: !settings.visible }, 'visibility')}
          className="flex min-h-11 items-center justify-between gap-4 rounded-xl text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bloom-pink disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
        >
          <span>
            <span id="ordering-visibility-label" className="block text-sm font-semibold text-ivory">Tampilkan di halaman publik</span>
            <span className="mt-1 flex items-center gap-1.5 text-xs text-ink/65" aria-live="polite">
              {(loading || saving === 'visibility') && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
              {loading ? 'Memuat pengaturan…' : saving === 'visibility' ? 'Menyimpan…' : !settings ? 'Pengaturan belum tersedia' : settings.visible ? 'Tampil untuk pengunjung' : 'Tersembunyi dari pengunjung'}
            </span>
          </span>
          <span aria-hidden="true" className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors motion-reduce:transition-none ${settings?.visible ? 'bg-bloom-pink border-bloom-pink' : 'bg-field border-ink/30'}`}>
            <span className={`absolute left-1 top-1 h-[18px] w-[18px] rounded-full transition-transform motion-reduce:transition-none ${settings?.visible ? 'translate-x-5 bg-on-accent' : 'bg-ink/75'}`} />
          </span>
        </button>
      </div>

      <form onSubmit={handleSaveLink} className="mt-5 border-t border-ink/10 pt-5">
        <label htmlFor="ordering-tally-url" className="block text-sm font-semibold text-ivory">Link Tally <span className="font-normal text-ink/55">(opsional)</span></label>
        <div className="mt-2 flex flex-col sm:flex-row gap-3">
          <input
            id="ordering-tally-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            maxLength={2048}
            value={draftUrl}
            onChange={(event) => setDraftUrl(event.target.value)}
            disabled={disabled}
            placeholder="https://tally.so/r/…"
            aria-describedby="ordering-tally-help"
            className="min-w-0 flex-1 rounded-xl border border-bloom-pink/20 bg-field px-4 py-3 text-sm text-ivory placeholder:text-ink/40 focus:border-bloom-pink focus:outline-none disabled:opacity-50"
          />
          <button type="submit" disabled={disabled || draftUrl.trim() === settings?.tallyUrl} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-bloom-pink px-5 py-3 text-sm font-bold text-on-accent transition-colors hover:bg-bloom-pink-deep focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-bloom-pink disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
            {saving === 'link' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {saving === 'link' ? 'Menyimpan…' : 'Simpan Link'}
          </button>
        </div>
        <p id="ordering-tally-help" className="mt-2 text-xs leading-relaxed text-ink/65">Kosongkan link untuk pop-up “Fitur akan segera tersedia”. Isi dan simpan ketika form Tally siap digunakan.</p>
      </form>

      {feedback && (
        <div role={feedback.error ? 'alert' : 'status'} className={`mt-4 flex items-start gap-2 text-sm leading-relaxed ${feedback.error ? 'text-red-300' : 'text-mint'}`}>
          {feedback.error ? <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
          <div>
            <p>{feedback.message}</p>
            {!settings && !loading && <button type="button" onClick={() => void loadSettings()} className="mt-2 min-h-11 font-semibold underline underline-offset-4 cursor-pointer">Coba lagi</button>}
          </div>
        </div>
      )}
    </section>
  );
}

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, CheckCircle2, AlertTriangle, XCircle, LayoutDashboard, LogOut, Camera, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Dialog from '@/components/Dialog';
import { secureFetch } from '@/lib/csrfClient';
import GardenArtwork, { GARDEN_IMAGES } from '@/components/GardenArtwork';
import GlobalGardenBackdrop from '@/components/GlobalGardenBackdrop';
import GardenFrame from '@/components/GardenFrame';

export default function AdminScanPage() {
  const router = useRouter();
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<{
    status: 'idle' | 'success' | 'warning' | 'error';
    message: string;
    participant?: any;
  }>({ status: 'idle', message: '' });

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  // ponytail: ignore re-decodes of the same token within cooldown so a held QR isn't scanned repeatedly.
  const SCAN_COOLDOWN_MS = 3000;
  const lastScanRef = useRef<{ token: string; at: number }>({ token: '', at: 0 });

  const shouldIgnoreScan = (token: string): boolean => {
    const { token: lastToken, at } = lastScanRef.current;
    return token === lastToken && Date.now() - at < SCAN_COOLDOWN_MS;
  };

  const triggerBeep = (type: 'success' | 'error') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
      } else {
        osc.frequency.setValueAtTime(300, audioCtx.currentTime);
        osc.frequency.setValueAtTime(200, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.35);
      }
    } catch {
      // audio context not allowed without interaction
    }
  };

  const processCheckIn = async (token: string) => {
    if (!token || loading) return;
    if (shouldIgnoreScan(token)) return;
    lastScanRef.current = { token, at: Date.now() };
    setLoading(true);

    try {
      const res = await secureFetch('/api/admin/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: token }),
      });

      if (res.status === 401) {
        router.push('/admin/login');
        return;
      }

      const data = await res.json();

      if (data.success) {
        triggerBeep('success');
        setScanResult({
          status: 'success',
          message: data.message || 'Check-in Berhasil!',
          participant: data.participant,
        });
      } else {
        triggerBeep('error');
        setScanResult({
          status: data.participant ? 'warning' : 'error',
          message: data.message || 'Tiket Tidak Valid!',
          participant: data.participant,
        });
      }
    } catch {
      setScanResult({
        status: 'error',
        message: 'Koneksi gagal saat memverifikasi tiket.',
      });
    } finally {
      setLoading(false);
    }
  };

  const startCamera = async () => {
    try {
      const qrScanner = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = qrScanner;

      await qrScanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: (viewfinderWidth, viewfinderHeight) => {
          const edge = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.7);
          return { width: edge, height: edge };
        } },
        (decodedText) => {
          processCheckIn(decodedText);
        },
        () => {
          // scanning frame (ignore)
        }
      );
      setScanning(true);
    } catch (err) {
      console.warn('Camera start error:', err);
      setCameraError('Tidak dapat mengakses kamera. Silakan periksa izin browser atau gunakan input manual.');
    }
  };

  const stopCamera = async () => {
    if (html5QrCodeRef.current) {
      try {
        if (html5QrCodeRef.current.isScanning) {
          await html5QrCodeRef.current.stop();
        }
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.warn('Camera stop error:', err);
      }
      setScanning(false);
    }
  };

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        try {
          if (html5QrCodeRef.current.isScanning) {
            html5QrCodeRef.current.stop().catch(() => {});
          }
          html5QrCodeRef.current.clear();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, []);

  const handleLogout = async () => {
    await secureFetch('/api/admin/logout', { method: 'POST' });
    router.push('/admin/login');
  };

  return (
    <main className="relative min-h-screen bg-transparent text-ink p-4 sm:p-6 lg:p-8 overflow-hidden">
      <GlobalGardenBackdrop />
      <GardenFrame variant="subtle" />
      {/* Small flower accents — matches the login page */}
      <GardenArtwork
        src={GARDEN_IMAGES.flowerMini}
        interaction="swaySoft"
        className="absolute top-8 left-[6%] w-10 sm:w-14 z-0 origin-bottom opacity-70"
      />
      <GardenArtwork
        src={GARDEN_IMAGES.flowerMini2}
        interaction="swaySoft"
        className="absolute top-8 right-[6%] w-10 sm:w-14 z-0 origin-bottom opacity-70 scale-x-[-1]"
      />
      <div className="relative z-10 max-w-7xl mx-auto">
        
        {/* Header panitia */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-bloom-pink/20 gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-bloom-pink block mb-1">
              Check-In Pintu Masuk
            </span>
            <h1 className="font-cinzel text-2xl sm:text-3xl font-bold text-ivory">
              Scanner Tiket Audiens
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-card border border-bloom-pink/30 text-xs font-semibold text-bloom-pink hover:bg-surface-card transition-colors"
            >
              <LayoutDashboard className="w-4 h-4" />
              Lihat Dashboard
            </Link>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 hover:bg-red-900/40 transition-colors text-xs"
              title="Keluar"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scan Status Banner */}
        {scanResult.status !== 'idle' && (
          <div
            className={`mb-6 p-5 rounded-2xl border transition-all ${
              scanResult.status === 'success'
                ? 'bg-surface-card border-mint text-mint'
                : scanResult.status === 'warning'
                ? 'bg-amber-950/80 border-amber-500/60 text-amber-200'
                : 'bg-red-950/80 border-red-500/60 text-red-200'
            }`}
          >
            <div className="flex items-start gap-3">
              {scanResult.status === 'success' && <CheckCircle2 className="w-6 h-6 shrink-0 mt-0.5" />}
              {scanResult.status === 'warning' && <AlertTriangle className="w-6 h-6 shrink-0 mt-0.5" />}
              {scanResult.status === 'error' && <XCircle className="w-6 h-6 shrink-0 mt-0.5" />}
              
              <div className="flex-1">
                <h3 className="font-bold text-base sm:text-lg">
                  {scanResult.message}
                </h3>
                {scanResult.participant && (
                  <div className="mt-2 text-xs sm:text-sm grid grid-cols-1 sm:grid-cols-2 gap-1 text-ink/90 font-mono">
                    <p><span className="text-bloom-pink">Nama:</span> {scanResult.participant.name}</p>
                    <p><span className="text-bloom-pink">NIM/NIP:</span> {scanResult.participant.nimNip}</p>
                    <p><span className="text-bloom-pink">Peran:</span> {scanResult.participant.role}</p>
                    <p><span className="text-bloom-pink">Prodi:</span> {scanResult.participant.prodi}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scanner (full-width) & Manual Input */}
        <div className="space-y-6">
          
          {/* Camera Scanner Box */}
<div className="rounded-3xl p-6 bg-gradient-to-b from-surface-card to-surface-card-2 border border-bloom-pink/30 shadow-[0_0_40px_rgba(183,156,232,0.18)] flex flex-col items-center justify-between">
            <div className="w-full text-center mb-4">
              <span className="font-cinzel font-bold text-base text-gold block">
                Kamera QR Scanner
              </span>
              <p className="text-xs text-ink/60 mt-1">
                Arahkan kamera ke QR Code pada ponsel audiens
              </p>
            </div>

            {/* Video preview target */}
            <div className="w-full aspect-square max-w-2xl bg-black/60 rounded-2xl overflow-hidden border-2 border-bloom-pink/40 relative flex items-center justify-center">
              <div id="qr-reader" className="w-full h-full" />
              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-surface-base/90">
                  <QrCode className="w-16 h-16 text-bloom-pink/40 mb-3" />
                  <p className="text-xs text-ink/70 mb-4">
                    Kamera belum aktif. Tekan tombol di bawah untuk mulai scan.
                  </p>
                </div>
              )}
            </div>

            {/* Camera Control Button */}
            <div className="w-full max-w-2xl mt-5">
              {!scanning ? (
                <button
                  onClick={startCamera}
                  className="w-full py-3 rounded-xl bg-bloom-pink text-on-accent font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" /> Buka Kamera Scanner
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="w-full py-3 rounded-xl bg-red-900/60 border border-red-500/40 text-red-200 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-red-800/60 transition-all cursor-pointer"
                >
                  Hentikan Kamera
                </button>
              )}
            </div>
          </div>

          {/* Manual Input Box */}
<div className="rounded-3xl p-6 bg-gradient-to-b from-surface-card to-surface-card-2 border border-bloom-pink/30 shadow-[0_0_40px_rgba(183,156,232,0.18)] flex flex-col justify-between">
            <div>
              <span className="font-cinzel font-bold text-base text-gold block">
                Input Kode Tiket Manual
              </span>
              <p className="text-xs text-ink/60 mt-1 mb-6">
                Alternatif jika kamera terkendala atau menggunakan barcode scanner USB
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-gold font-semibold mb-2">
                    Kode Tiket / QR Token
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: FAN26-xxxx..."
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        processCheckIn(manualCode);
                      }
                    }}
                    className="w-full px-4 py-3.5 rounded-xl bg-field border border-bloom-pink/30 focus:border-bloom-pink focus:ring-2 focus:ring-bloom-pink/20 text-sm text-ivory font-mono outline-hidden"
                  />
                </div>

                <button
                  onClick={() => processCheckIn(manualCode)}
                  disabled={loading || !manualCode}
                  className="w-full py-3.5 rounded-xl bg-surface-card border border-bloom-pink/50 text-bloom-pink font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-surface-card transition-all cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memverifikasi...
                    </>
                  ) : (
                    <>
                      Verifikasi Tiket <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="mt-6 p-4 rounded-2xl bg-field-2/60 border border-white/5 text-[11px] text-ink/60 leading-relaxed">
              <p className="font-bold text-bloom-pink mb-1">Panduan Panitia:</p>
              Setiap tiket hanya dapat diverifikasi <span className="text-gold">satu kali</span>. Jika peserta sudah pernah check-in, sistem akan menolak dan menampilkan stempel waktu check-in sebelumnya.
            </div>

          </div>

        </div>

      </div>

      <Dialog
        open={!!cameraError}
        variant="info"
        title="Kamera Tidak Tersedia"
        message={cameraError || ''}
        confirmLabel="Mengerti"
        onClose={() => setCameraError(null)}
      />
    </main>
  );
}

'use client';

import React, { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Participant } from '@/lib/types';
import { Sparkles, Calendar, MapPin, Download, CheckCircle, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import Card3D from './Card3D';

interface TicketCardProps {
  participant: Participant;
}

export default function TicketCard({ participant }: TicketCardProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Generate and download HD Ticket Image (.png) wrapped in Magical Secret Garden theme
  const handleDownloadTicketImage = async () => {
    setDownloading(true);

    try {
      // Create high-resolution in-memory canvas
      const width = 1000;
      const height = 1420;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Canvas context not available');

      // 1. Dark Emerald Magical Background Gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#0E2D22');
      bgGrad.addColorStop(0.3, '#0A2019');
      bgGrad.addColorStop(0.7, '#071813');
      bgGrad.addColorStop(1, '#040F0B');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // 2. Ambient Magical Lighting Glows
      const glowTop = ctx.createRadialGradient(width / 2, 200, 10, width / 2, 200, 450);
      glowTop.addColorStop(0, 'rgba(175, 248, 219, 0.15)');
      glowTop.addColorStop(0.5, 'rgba(255, 243, 176, 0.08)');
      glowTop.addColorStop(1, 'transparent');
      ctx.fillStyle = glowTop;
      ctx.fillRect(0, 0, width, 500);

      const glowCenter = ctx.createRadialGradient(width / 2, 820, 20, width / 2, 820, 400);
      glowCenter.addColorStop(0, 'rgba(175, 248, 219, 0.18)');
      glowCenter.addColorStop(1, 'transparent');
      ctx.fillStyle = glowCenter;
      ctx.fillRect(0, 500, width, 600);

      // 3. Card Outer & Inner Borders
      const margin = 40;
      const cardW = width - margin * 2;
      const cardH = height - margin * 2;
      const radius = 36;

      // Rounded rect path
      ctx.beginPath();
      ctx.roundRect(margin, margin, cardW, cardH, radius);
      ctx.strokeStyle = '#FFF3B0';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = 'rgba(255, 243, 176, 0.5)';
      ctx.shadowBlur = 20;
      ctx.stroke();
      ctx.shadowBlur = 0; // reset shadow

      // Inner hairline border
      ctx.beginPath();
      ctx.roundRect(margin + 12, margin + 12, cardW - 24, cardH - 24, radius - 8);
      ctx.strokeStyle = 'rgba(175, 248, 219, 0.35)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // 4. Corner Filigree Brackets
      const drawCornerBracket = (x: number, y: number, angle: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate((angle * Math.PI) / 180);
        ctx.strokeStyle = '#AFF8DB';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 30);
        ctx.lineTo(0, 0);
        ctx.lineTo(30, 0);
        ctx.stroke();

        // Small decorative diamond dot
        ctx.fillStyle = '#FFF3B0';
        ctx.beginPath();
        ctx.arc(8, 8, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      drawCornerBracket(margin + 20, margin + 20, 0);
      drawCornerBracket(width - margin - 20, margin + 20, 90);
      drawCornerBracket(width - margin - 20, height - margin - 20, 180);
      drawCornerBracket(margin + 20, height - margin - 20, 270);

      // 5. Header VIP Pass Badge
      ctx.textAlign = 'center';
      const badgeY = 110;
      const badgeW = 260;
      const badgeH = 40;
      ctx.fillStyle = '#184535';
      ctx.beginPath();
      ctx.roundRect((width - badgeW) / 2, badgeY, badgeW, badgeH, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 243, 176, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = '#FFF3B0';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText('✦  OFFICIAL VIP PASS  ✦', width / 2, badgeY + 26);

      // Title & Subtitle
      ctx.font = 'bold 36px serif';
      ctx.fillStyle = '#FAF7F0';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 10;
      ctx.fillText('FASILKOM AWARDING NIGHT', width / 2, 200);
      ctx.shadowBlur = 0;

      ctx.font = '600 18px serif';
      ctx.fillStyle = '#AFF8DB';
      ctx.letterSpacing = '4px';
      ctx.fillText('SECRET GARDEN : DREAMS TO HISTORY', width / 2, 235);
      ctx.letterSpacing = '0px';

      // Header divider line
      const lineGrad = ctx.createLinearGradient(120, 0, width - 120, 0);
      lineGrad.addColorStop(0, 'transparent');
      lineGrad.addColorStop(0.5, 'rgba(175, 248, 219, 0.6)');
      lineGrad.addColorStop(1, 'transparent');
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(100, 265);
      ctx.lineTo(width - 100, 265);
      ctx.stroke();

      // 6. Attendee Info Section
      ctx.font = 'bold 13px sans-serif';
      ctx.fillStyle = 'rgba(237, 232, 223, 0.7)';
      ctx.fillText('NAMA LENGKAP MAHASISWA', width / 2, 315);

      ctx.font = 'bold 36px serif';
      ctx.fillStyle = '#FFF3B0';
      ctx.shadowColor = 'rgba(255, 243, 176, 0.4)';
      ctx.shadowBlur = 15;
      ctx.fillText(participant.name, width / 2, 365);
      ctx.shadowBlur = 0;

      // Status Civitas & Program Studi
      ctx.font = '600 18px sans-serif';
      ctx.fillStyle = '#EDE8DF';
      ctx.fillText(`Mahasiswa S1  •  ${participant.prodi}`, width / 2, 405);

      // NIM & Status Box
      const infoBoxY = 440;
      const infoBoxW = 760;
      const infoBoxH = 80;
      ctx.fillStyle = 'rgba(6, 24, 17, 0.9)';
      ctx.beginPath();
      ctx.roundRect((width - infoBoxW) / 2, infoBoxY, infoBoxW, infoBoxH, 20);
      ctx.fill();
      ctx.strokeStyle = 'rgba(175, 248, 219, 0.25)';
      ctx.lineWidth = 1.2;
      ctx.stroke();

      // NIM
      ctx.textAlign = 'center';
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(237, 232, 223, 0.6)';
      ctx.fillText('NOMOR INDUK MAHASISWA (NIM)', width / 2 - 180, infoBoxY + 30);
      ctx.font = 'bold 22px monospace';
      ctx.fillStyle = '#FAF7F0';
      ctx.fillText(participant.nimNip, width / 2 - 180, infoBoxY + 60);

      // Status
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(237, 232, 223, 0.6)';
      ctx.fillText('STATUS TIKET', width / 2 + 180, infoBoxY + 30);
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#AFF8DB';
      ctx.fillText('✓ Terverifikasi (Aktif)', width / 2 + 180, infoBoxY + 58);

      // 7. QR Code Canvas Rendering
      const qrSize = 340;
      const qrX = (width - qrSize) / 2;
      const qrY = 560;

      // QR White Container Box with Glow
      const pad = 24;
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(175, 248, 219, 0.5)';
      ctx.shadowBlur = 35;
      ctx.beginPath();
      ctx.roundRect(qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, 28);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Outer mint rim
      ctx.strokeStyle = '#AFF8DB';
      ctx.lineWidth = 6;
      ctx.stroke();

      // Draw the QR Code image from hidden QR canvas
      const sourceQrCanvas = qrCanvasRef.current;
      if (sourceQrCanvas) {
        ctx.drawImage(sourceQrCanvas, qrX, qrY, qrSize, qrSize);
      }

      // 8. Token & Instructions Below QR
      ctx.textAlign = 'center';
      ctx.font = 'bold 16px monospace';
      ctx.fillStyle = '#AFF8DB';
      ctx.fillText(participant.qrToken, width / 2, 990);

      ctx.font = '300 15px sans-serif';
      ctx.fillStyle = 'rgba(237, 232, 223, 0.75)';
      ctx.fillText(
        'Tunjukkan QR Code ini kepada panitia registrasi di pintu masuk',
        width / 2,
        1025
      );
      ctx.fillText(
        'Gedung Biru Fakultas Ilmu Komputer, Universitas Jember.',
        width / 2,
        1050
      );

      // 9. Footer Divider & Venue/Date Info
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(100, 1100);
      ctx.lineTo(width - 100, 1100);
      ctx.stroke();

      // Event Details Footer
      ctx.textAlign = 'left';
      ctx.font = '16px sans-serif';
      ctx.fillStyle = '#FAF7F0';
      ctx.fillText('📅  Jumat, 20 November 2026 • 17:30 WIB', 120, 1150);

      ctx.textAlign = 'right';
      ctx.fillText('📍  Auditorium Gedung Biru, Fasilkom UNEJ', width - 120, 1150);

      // Bottom Branding
      ctx.textAlign = 'center';
      ctx.font = '12px sans-serif';
      ctx.fillStyle = 'rgba(237, 232, 223, 0.4)';
      ctx.fillText(
        'Diterbitkan secara resmi oleh Panitia Fasilkom Awarding Night 2026',
        width / 2,
        1210
      );

      // 10. Trigger Download as PNG File
      const dataUrl = canvas.toDataURL('image/png', 1.0);
      const link = document.createElement('a');
      const safeName = participant.name.replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `Tiket-FAN2026-${safeName}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to generate ticket image:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="max-w-xl w-full mx-auto">
      
      {/* Hidden high-res QR Canvas for crystal clear image export */}
      <div className="hidden" aria-hidden="true">
        <QRCodeCanvas
          ref={qrCanvasRef}
          value={participant.qrToken}
          size={512}
          level="H"
          marginSize={0}
          fgColor="#061811"
          bgColor="#ffffff"
        />
      </div>

      {/* Back button & ID */}
      <div className="mb-6 flex items-center justify-between no-print">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#AFF8DB] hover:text-[#FFF3B0] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali ke Beranda
        </Link>
        <span className="text-[11px] font-mono text-[#EDE8DF]/60 bg-[#12382B] px-3 py-1 rounded-full border border-[#AFF8DB]/30">
          ID: {participant.id}
        </span>
      </div>

      {/* The Printable VIP Ticket Card wrapped in 3D Card */}
      <Card3D glowColor="rgba(255, 243, 176, 0.25)">
        <div
          id="ticket-pass"
          className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-[#0F2D23] via-[#0A2019] to-[#061510] border-2 border-[#FFF3B0]/60 shadow-[0_0_50px_rgba(255,243,176,0.25)] p-6 sm:p-8"
        >
          {/* Decorative corner borders */}
          <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-[#AFF8DB]" />
          <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-[#AFF8DB]" />
          <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-[#AFF8DB]" />
          <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-[#AFF8DB]" />

          {/* Ambient watermark glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#AFF8DB]/10 rounded-full blur-2xl pointer-events-none" />

          {/* Ticket Header */}
          <div className="text-center relative z-10 pb-6 border-b border-[#AFF8DB]/20">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#184535] text-[#FFF3B0] text-[10px] uppercase font-bold tracking-[0.25em] mb-2 border border-[#FFF3B0]/40">
              <Sparkles className="w-3 h-3 text-[#AFF8DB]" />
              Official VIP Pass
            </div>
            <h2 className="font-cinzel text-xl sm:text-2xl font-black tracking-wider text-[#FAF7F0]">
              FASILKOM AWARDING NIGHT
            </h2>
            <span className="font-cinzel text-xs tracking-[0.25em] text-[#AFF8DB] block font-semibold mt-0.5">
              SECRET GARDEN : DREAMS TO HISTORY
            </span>
          </div>

          {/* Ticket Content Body */}
          <div className="py-6 space-y-5 relative z-10">
            
            {/* Attendee Name & Role */}
            <div className="text-center">
              <span className="text-[10px] uppercase font-bold tracking-widest text-[#EDE8DF]/60 block mb-1">
                Nama Lengkap Mahasiswa
              </span>
              <h3 className="font-cinzel text-xl sm:text-2xl font-bold text-[#FFF3B0]">
                {participant.name}
              </h3>
              <div className="flex items-center justify-center gap-2 mt-2">
                <span className="px-3 py-0.5 rounded-full bg-[#174837] text-[#AFF8DB] text-xs font-bold border border-[#AFF8DB]/40">
                  Mahasiswa S1
                </span>
                <span className="text-xs text-[#EDE8DF]/80 font-medium">
                  {participant.prodi}
                </span>
              </div>
            </div>

            {/* Identifier Details */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-[#061811]/90 border border-white/10 text-center text-xs">
              <div>
                <span className="text-[10px] text-[#EDE8DF]/60 block uppercase tracking-wider">
                  NIM
                </span>
                <span className="font-mono font-bold text-[#FAF7F0] mt-0.5 block">
                  {participant.nimNip}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-[#EDE8DF]/60 block uppercase tracking-wider">
                  Status Tiket
                </span>
                <span
                  className={`font-bold mt-0.5 inline-flex items-center gap-1 ${
                    participant.isCheckedIn ? 'text-amber-400' : 'text-[#AFF8DB]'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {participant.isCheckedIn ? 'Sudah Check-In' : 'Terverifikasi (Aktif)'}
                </span>
              </div>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center pt-2">
              <div className="p-4 bg-white rounded-2xl shadow-[0_0_25px_rgba(255,243,176,0.3)] border-4 border-[#AFF8DB]">
                <QRCodeCanvas
                  value={participant.qrToken}
                  size={180}
                  level="H"
                  fgColor="#061811"
                  bgColor="#ffffff"
                />
              </div>
              <span className="text-[11px] font-mono text-[#AFF8DB] mt-3 tracking-wider font-semibold">
                {participant.qrToken}
              </span>
              <p className="text-[11px] text-[#EDE8DF]/60 text-center mt-1 max-w-xs font-light">
                Tunjukkan QR Code ini kepada panitia registrasi di pintu masuk Gedung Biru Fasilkom UNEJ.
              </p>
            </div>

            {/* Event Quick Info Footer on Pass */}
            <div className="pt-4 border-t border-[#AFF8DB]/20 grid grid-cols-2 gap-2 text-[11px] text-[#EDE8DF]/80">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#AFF8DB] shrink-0" />
                <span>Jumat, 20 Nov 2026 &bull; 17:30 WIB</span>
              </div>
              <div className="flex items-center gap-1.5 justify-end">
                <MapPin className="w-3.5 h-3.5 text-[#FFB5E8] shrink-0" />
                <span>Auditorium Fasilkom</span>
              </div>
            </div>

          </div>

        </div>
      </Card3D>

      {/* Single Clean Action Button */}
      <div className="mt-6 no-print">
        <button
          onClick={handleDownloadTicketImage}
          disabled={downloading}
          className="w-full py-4 px-6 rounded-2xl bg-[#AFF8DB] hover:bg-[#86efc3] text-[#061811] font-bold text-base tracking-wide shadow-[0_0_30px_rgba(175,248,219,0.6)] hover:shadow-[0_0_45px_rgba(175,248,219,0.9)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-3 cursor-pointer"
        >
          {downloading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin text-[#061811]" />
              Menyiapkan Gambar Tiket...
            </>
          ) : (
            <>
              <Download className="w-5 h-5 text-[#061811]" />
              Unduh Gambar Tiket (PNG)
            </>
          )}
        </button>
      </div>

    </div>
  );
}

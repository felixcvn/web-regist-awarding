'use client';

import React, { useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Sparkles, Calendar, MapPin, Download, CheckCircle, Printer } from 'lucide-react';

export interface TeamQrMember {
  nimNip: string;
  nama: string;
}

interface TeamQrCardProps {
  namaTeam: string;
  qrToken: string;
  members: TeamQrMember[];
  isCheckedIn?: boolean;
}

function safeFileName(name: string) {
  const slug = name.replace(/[^a-zA-Z0-9]/g, '_');
  return slug || 'Tim_Nominasi';
}

function truncateToWidth(ctx: CanvasRenderingContext2D, value: string, maxWidth: number) {
  if (ctx.measureText(value).width <= maxWidth) return value;
  let text = value;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) {
    text = text.slice(0, -1);
  }
  return `${text}…`;
}

export default function TeamQrCard({ namaTeam, qrToken, members, isCheckedIn = false }: TeamQrCardProps) {
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState(false);

  // Renders the same ticket layout as the participant pass, with the team name
  // and member list in place of the attendee fields.
  const renderCardCanvas = async () => {
    const sourceQrCanvas = qrCanvasRef.current;
    if (!sourceQrCanvas) throw new Error('QR Code belum siap. Coba lagi.');

    const width = 1000;
    const margin = 40;

    const memberRowH = 30;
    const membersBoxW = 760;
    const membersBoxH = 56 + members.length * memberRowH;
    const membersBoxY = 440;

    const infoBoxY = membersBoxY + membersBoxH + 24;
    const infoBoxH = 80;
    const infoBoxW = 760;

    const qrSize = 320;
    const qrY = infoBoxY + infoBoxH + 40;
    const tokenY = qrY + qrSize + 84;
    const dividerY = tokenY + 110;
    const footerY = dividerY + 50;
    const brandingY = footerY + 60;
    const height = brandingY + 60 + margin;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas context not available');

    // Wait for the display font, but never block the export for long.
    await Promise.race([
      document.fonts.load('700 40px "Cormorant Garamond"'),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#160f22');
    bgGrad.addColorStop(0.3, '#1f1430');
    bgGrad.addColorStop(0.7, '#2d1836');
    bgGrad.addColorStop(1, '#3a1c38');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Ambient glows
    const glowTop = ctx.createRadialGradient(width / 2, 200, 10, width / 2, 200, 450);
    glowTop.addColorStop(0, 'rgba(255, 181, 232, 0.2)');
    glowTop.addColorStop(0.5, 'rgba(255, 243, 176, 0.08)');
    glowTop.addColorStop(1, 'transparent');
    ctx.fillStyle = glowTop;
    ctx.fillRect(0, 0, width, 500);

    const glowCenter = ctx.createRadialGradient(width / 2, qrY + qrSize / 2, 20, width / 2, qrY + qrSize / 2, 400);
    glowCenter.addColorStop(0, 'rgba(245, 138, 212, 0.22)');
    glowCenter.addColorStop(1, 'transparent');
    ctx.fillStyle = glowCenter;
    ctx.fillRect(0, qrY - 200, width, qrSize + 400);

    // Card borders
    const cardW = width - margin * 2;
    const cardH = height - margin * 2;
    const radius = 36;

    ctx.beginPath();
    ctx.roundRect(margin, margin, cardW, cardH, radius);
    ctx.strokeStyle = '#FFB5E8';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = 'rgba(255, 181, 232, 0.5)';
    ctx.shadowBlur = 20;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.roundRect(margin + 12, margin + 12, cardW - 24, cardH - 24, radius - 8);
    ctx.strokeStyle = 'rgba(255, 181, 232, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Corner brackets
    const drawCornerBracket = (x: number, y: number, angle: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate((angle * Math.PI) / 180);
      ctx.strokeStyle = '#FFB5E8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 30);
      ctx.lineTo(0, 0);
      ctx.lineTo(30, 0);
      ctx.stroke();
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

    // Header badge
    ctx.textAlign = 'center';
    const badgeY = 110;
    const badgeW = 260;
    const badgeH = 40;
    ctx.fillStyle = '#241835';
    ctx.beginPath();
    ctx.roundRect((width - badgeW) / 2, badgeY, badgeW, badgeH, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 181, 232, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#FFB5E8';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('✦  OFFICIAL VIP PASS  ✦', width / 2, badgeY + 26);

    ctx.font = 'bold 36px serif';
    ctx.fillStyle = '#FAF7F0';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 10;
    ctx.fillText('FASILKOM AWARDING NIGHT', width / 2, 200);
    ctx.shadowBlur = 0;

    ctx.font = '600 18px serif';
    ctx.fillStyle = '#FFB5E8';
    ctx.fillText('SECRET GARDEN : DREAMS TO HISTORY', width / 2, 235);

    const lineGrad = ctx.createLinearGradient(120, 0, width - 120, 0);
    lineGrad.addColorStop(0, 'transparent');
    lineGrad.addColorStop(0.5, 'rgba(255, 181, 232, 0.7)');
    lineGrad.addColorStop(1, 'transparent');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(100, 265);
    ctx.lineTo(width - 100, 265);
    ctx.stroke();

    // Team name
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = 'rgba(237, 232, 223, 0.7)';
    ctx.fillText('NAMA TIM NOMINASI', width / 2, 315);

    ctx.font = 'bold 40px "Cormorant Garamond", Georgia, serif';
    ctx.fillStyle = '#FFB5E8';
    ctx.shadowColor = 'rgba(255, 181, 232, 0.5)';
    ctx.shadowBlur = 15;
    ctx.fillText(truncateToWidth(ctx, namaTeam, width - 200), width / 2, 365);
    ctx.shadowBlur = 0;

    ctx.font = '600 18px sans-serif';
    ctx.fillStyle = '#EDE8DF';
    ctx.fillText(`Nominasi Tim  •  ${members.length} Anggota`, width / 2, 405);

    // Member list box
    const membersX = (width - membersBoxW) / 2;
    ctx.fillStyle = 'rgba(22, 15, 34, 0.9)';
    ctx.beginPath();
    ctx.roundRect(membersX, membersBoxY, membersBoxW, membersBoxH, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 181, 232, 0.3)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillStyle = 'rgba(237, 232, 223, 0.65)';
    ctx.fillText(`ANGGOTA TIM (${members.length})`, membersX + 28, membersBoxY + 34);

    members.forEach((member, index) => {
      const rowY = membersBoxY + 64 + index * memberRowH;
      ctx.font = '20px sans-serif';
      ctx.fillStyle = 'rgba(237, 232, 223, 0.5)';
      ctx.fillText(`${index + 1}.`, membersX + 28, rowY);

      ctx.fillStyle = '#FAF7F0';
      const nimWidth = 200;
      const nameMax = membersBoxW - 28 * 2 - 34 - nimWidth - 16;
      ctx.fillText(truncateToWidth(ctx, member.nama || '-', nameMax), membersX + 62, rowY);

      ctx.textAlign = 'right';
      ctx.font = 'bold 17px monospace';
      ctx.fillStyle = 'rgba(255, 181, 232, 0.85)';
      ctx.fillText(member.nimNip, membersX + membersBoxW - 28, rowY);
      ctx.textAlign = 'left';
    });

    // Info box: member count + team status
    const infoBoxX = (width - infoBoxW) / 2;
    ctx.fillStyle = 'rgba(22, 15, 34, 0.9)';
    ctx.beginPath();
    ctx.roundRect(infoBoxX, infoBoxY, infoBoxW, infoBoxH, 20);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 181, 232, 0.3)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(237, 232, 223, 0.6)';
    ctx.fillText('JUMLAH ANGGOTA', width / 2 - 180, infoBoxY + 30);
    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#FAF7F0';
    ctx.fillText(String(members.length), width / 2 - 180, infoBoxY + 60);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(237, 232, 223, 0.6)';
    ctx.fillText('STATUS TIM', width / 2 + 180, infoBoxY + 30);
    ctx.font = 'bold 18px sans-serif';
    ctx.fillStyle = '#FFB5E8';
    ctx.fillText(isCheckedIn ? '✓ Sudah Check-In' : '✓ Terverifikasi (Aktif)', width / 2 + 180, infoBoxY + 58);

    // QR Code
    const qrX = (width - qrSize) / 2;
    const pad = 24;
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(255, 181, 232, 0.5)';
    ctx.shadowBlur = 35;
    ctx.beginPath();
    ctx.roundRect(qrX - pad, qrY - pad, qrSize + pad * 2, qrSize + pad * 2, 28);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#FFB5E8';
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.drawImage(sourceQrCanvas, qrX, qrY, qrSize, qrSize);

    // Token & instruction
    ctx.textAlign = 'center';
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#FFB5E8';
    ctx.fillText(qrToken, width / 2, tokenY);

    ctx.font = '300 15px sans-serif';
    ctx.fillStyle = 'rgba(237, 232, 223, 0.75)';
    ctx.fillText('Tunjukkan QR Code ini kepada panitia registrasi di pintu masuk', width / 2, tokenY + 35);
    ctx.fillText('Gedung Soetardjo, Universitas Jember', width / 2, tokenY + 60);

    // Footer
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(100, dividerY);
    ctx.lineTo(width - 100, dividerY);
    ctx.stroke();

    ctx.textAlign = 'left';
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#FAF7F0';
    ctx.fillText('📅  Selasa, 1 Desember 2026 • 17:45 WIB', 120, footerY);

    ctx.textAlign = 'right';
    ctx.fillText('📍  Gedung Soetardjo, Universitas Jember', width - 120, footerY);

    ctx.textAlign = 'center';
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(237, 232, 223, 0.4)';
    ctx.fillText('Diterbitkan secara resmi oleh Panitia Fasilkom Awarding Night 2026', width / 2, brandingY);

    return canvas.toDataURL('image/png', 1.0);
  };

  const handleDownload = async () => {
    setBusy(true);
    try {
      const dataUrl = await renderCardCanvas();
      const link = document.createElement('a');
      link.download = `QR-Tim-FAN2026-${safeFileName(namaTeam)}.png`;
      link.href = dataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      window.alert((error as Error).message || 'Gagal mengunduh kartu QR.');
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = async () => {
    setBusy(true);
    try {
      const dataUrl = await renderCardCanvas();
      const printWindow = window.open('', '_blank', 'width=760,height=1000');
      if (!printWindow) {
        window.alert('Popup diblokir browser. Izinkan popup untuk mencetak kartu.');
        return;
      }
      printWindow.document.write(`<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>QR ${namaTeam}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 16px; background: #ffffff; }
  img { display: block; width: 100%; max-width: 520px; margin: 0 auto; }
  @media print { body { padding: 0; } }
</style>
</head>
<body><img src="${dataUrl}" alt="Kartu QR ${namaTeam}" onload="window.print()" /></body>
</html>`);
      printWindow.document.close();
    } catch (error) {
      window.alert((error as Error).message || 'Gagal mencetak kartu QR.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {/* Hidden high-res QR canvas for the exported image */}
      <div className="hidden" aria-hidden="true">
        <QRCodeCanvas
          ref={qrCanvasRef}
          value={qrToken}
          size={512}
          level="H"
          marginSize={5}
          fgColor="#000000"
          bgColor="#ffffff"
        />
      </div>

      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-surface-card via-surface-card-2 to-surface-base border-2 border-gold/60 shadow-[0_0_50px_rgba(183,156,232,0.25)] p-6">
        <div className="absolute top-3 left-3 w-6 h-6 border-t-2 border-l-2 border-bloom-pink" />
        <div className="absolute top-3 right-3 w-6 h-6 border-t-2 border-r-2 border-bloom-pink" />
        <div className="absolute bottom-3 left-3 w-6 h-6 border-b-2 border-l-2 border-bloom-pink" />
        <div className="absolute bottom-3 right-3 w-6 h-6 border-b-2 border-r-2 border-bloom-pink" />

        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-bloom-pink/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header */}
        <div className="text-center relative z-10 pb-5 border-b border-bloom-pink/20">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-surface-card text-gold text-[10px] uppercase font-bold tracking-[0.25em] mb-2 border border-gold/40">
            <Sparkles className="w-3 h-3 text-bloom-pink" />
            Official VIP Pass
          </div>
          <h2 className="font-cinzel text-lg sm:text-xl font-black tracking-wider text-ivory">
            FASILKOM AWARDING NIGHT
          </h2>
          <span className="font-cinzel text-[10px] tracking-[0.25em] text-bloom-pink block font-semibold mt-0.5">
            SECRET GARDEN : DREAMS TO HISTORY
          </span>
        </div>

        {/* Body */}
        <div className="py-5 space-y-4 relative z-10">
          <div className="text-center">
            <span className="text-[10px] uppercase font-bold tracking-widest text-ink/60 block mb-1">
              Nama Tim Nominasi
            </span>
            <h3 className="font-display text-2xl sm:text-3xl font-bold text-gold tracking-wide break-words">
              {namaTeam}
            </h3>
            <div className="flex items-center justify-center gap-2 mt-2">
              <span className="px-3 py-0.5 rounded-full bg-surface-card text-bloom-pink text-xs font-bold border border-bloom-pink/40">
                Nominasi Tim
              </span>
              <span className="text-xs text-ink/80 font-medium">{members.length} Anggota</span>
            </div>
          </div>

          {/* Member list */}
          <div className="p-3.5 rounded-2xl bg-field-2/90 border border-white/10">
            <span className="text-[10px] text-ink/60 block uppercase tracking-wider mb-2">
              Anggota Tim
            </span>
            <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {members.map((member, index) => (
                <li key={member.nimNip} className="flex items-baseline gap-2 text-[11px]">
                  <span className="w-4 shrink-0 text-ink/40 tabular-nums">{index + 1}.</span>
                  <span className="text-ivory truncate flex-1">{member.nama || '-'}</span>
                  <span className="shrink-0 font-mono text-[10px] text-bloom-pink/70">
                    {member.nimNip}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Count & status */}
          <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-field-2/90 border border-white/10 text-center text-xs">
            <div>
              <span className="text-[10px] text-ink/60 block uppercase tracking-wider">
                Jumlah Anggota
              </span>
              <span className="font-mono font-bold text-ivory mt-0.5 block">{members.length}</span>
            </div>
            <div>
              <span className="text-[10px] text-ink/60 block uppercase tracking-wider">
                Status Tim
              </span>
              <span
                className={`font-bold mt-0.5 inline-flex items-center gap-1 ${
                  isCheckedIn ? 'text-amber-400' : 'text-bloom-pink'
                }`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {isCheckedIn ? 'Sudah Check-In' : 'Terverifikasi (Aktif)'}
              </span>
            </div>
          </div>

          {/* QR */}
          <div className="flex flex-col items-center justify-center pt-1">
            <div className="p-4 bg-white rounded-2xl shadow-[0_0_25px_rgba(255,243,176,0.3)] border-4 border-bloom-pink">
              <QRCodeCanvas
                value={qrToken}
                size={180}
                level="H"
                marginSize={5}
                fgColor="#000000"
                bgColor="#ffffff"
              />
            </div>
            <span className="text-[11px] font-mono text-bloom-pink mt-3 tracking-wider font-semibold break-all text-center">
              {qrToken}
            </span>
            <p className="text-[11px] text-ink/60 text-center mt-1 max-w-xs font-light">
              Tunjukkan QR Code ini kepada panitia registrasi di pintu masuk Gedung Soetardjo, Universitas Jember.
            </p>
          </div>

          {/* Event footer */}
          <div className="pt-4 border-t border-bloom-pink/20 grid grid-cols-2 gap-2 text-[11px] text-ink/80">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-bloom-pink shrink-0" />
              <span>Selasa, 1 Des 2026 &bull; 17:45 WIB</span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <MapPin className="w-3.5 h-3.5 text-bloom-pink shrink-0" />
              <span>Gedung Soetardjo, Universitas Jember</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={handleDownload}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-bloom-pink hover:bg-bloom-pink-deep text-on-accent text-xs font-bold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" />
          {busy ? 'Menyiapkan...' : 'Unduh PNG'}
        </button>
        <button
          type="button"
          onClick={handlePrint}
          disabled={busy}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-surface-card border border-bloom-pink/30 text-xs font-bold text-bloom-pink hover:bg-surface-card transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Printer className="w-3.5 h-3.5" />
          Cetak
        </button>
      </div>
    </div>
  );
}

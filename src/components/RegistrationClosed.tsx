import React from 'react';
import { Lock, Ticket } from 'lucide-react';
import ScrollReveal from '@/components/ScrollReveal';
import { StarlightGlow } from '@/components/StarlightGlow';

export default function RegistrationClosed() {
  return (
    <section id="registrasi" className="relative py-24 px-4 sm:px-6 lg:px-8 bg-transparent text-ink overflow-hidden">
      <StarlightGlow className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-surface-card/30" />

      <div className="max-w-3xl mx-auto relative z-20">
        <ScrollReveal animation="fade-up">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-surface-card text-bloom-pink text-xs font-semibold tracking-widest uppercase mb-3 border border-bloom-pink/30 shadow-md">
              Gerbang Secret Garden
            </div>
            <h2 className="font-cinzel text-3xl sm:text-4xl md:text-5xl font-extrabold text-ivory tracking-wide">
              Pendaftaran Ditutup
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-bloom-pink to-transparent mx-auto mt-4" />
            <p className="text-xs sm:text-sm text-ink/80 mt-4 leading-relaxed font-light">
              Terima kasih atas antusiasme seluruh civitas Fasilkom.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal animation="zoom-in" delay={150}>
          <div className="relative">
            <div className="relative mx-auto max-w-lg">
              <div className="h-16 rounded-t-[50%] border-x-2 border-t-2 border-bloom-pink/40 bg-gradient-to-b from-surface-card/60 to-transparent" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-gradient-to-br from-gold to-bloom-pink-deep shadow-[0_0_16px_rgba(255,181,232,0.7)]" />
            </div>

            <div className="relative -mt-2 rounded-3xl p-8 sm:p-12 text-center bg-gradient-to-b from-surface-card/95 via-surface-card-2/95 to-surface-base/95 border border-bloom-pink/30 shadow-[0_0_50px_rgba(12,6,18,0.9)] backdrop-blur-md">
              <div className="pointer-events-none absolute inset-3 rounded-[1.75rem] border border-bloom-pink/15" />

              <div className="relative z-10">
                <div className="mx-auto mb-6 w-16 h-16 rounded-full flex items-center justify-center bg-surface-card border border-bloom-pink/40 shadow-[0_0_24px_rgba(255,181,232,0.25)]">
                  <Lock className="w-7 h-7 text-bloom-pink" />
                </div>

                <p className="text-sm sm:text-base text-ivory font-medium leading-relaxed">
                  Pendaftaran Fasilkom Awarding Night 2026 telah ditutup pada 27 November 2026.
                </p>
                <div className="w-16 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent mx-auto my-6" />
                <p className="text-xs sm:text-sm text-ink/80 font-light leading-relaxed inline-flex items-start gap-2 text-left max-w-md">
                  <Ticket className="w-4 h-4 text-gold shrink-0 mt-0.5" />
                  <span>
                    Tiket digital yang sudah diterbitkan tetap berlaku. Tunjukkan QR Code dari email konfirmasi Anda
                    kepada panitia di pintu masuk.
                  </span>
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

interface CountdownProps {
  targetDate?: string;
}

export default function Countdown({ targetDate = '2026-12-01T18:00:00' }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const destination = new Date(targetDate).getTime();

    const updateTimer = () => {
      const now = new Date().getTime();
      const difference = destination - now;

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((difference % (1000 * 60)) / 1000),
        });
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!mounted) {
    return (
      <div className="flex items-center justify-center gap-3 py-4">
        <div className="h-16 w-64 bg-[#143D30]/30 rounded-2xl animate-pulse" />
      </div>
    );
  }

  const units = [
    { label: 'HARI', value: timeLeft.days },
    { label: 'JAM', value: timeLeft.hours },
    { label: 'MENIT', value: timeLeft.minutes },
    { label: 'DETIK', value: timeLeft.seconds },
  ];

  return (
    <div className="relative inline-block w-full max-w-2xl mx-auto">
      {/* Decorative magical border frame */}
      <div className="relative rounded-3xl p-5 sm:p-6 bg-gradient-to-b from-[#102e23]/90 via-[#0a1e17]/95 to-[#061510]/95 border border-[#AFF8DB]/30 shadow-[0_0_40px_rgba(10,35,26,0.8)] backdrop-blur-md">
        
        {/* Header inside countdown card */}
        <div className="flex items-center justify-center gap-2 mb-4 text-[#FFF3B0]">
          <Clock className="w-4 h-4 text-[#AFF8DB] animate-spin" style={{ animationDuration: '12s' }} />
          <span className="font-cinzel text-xs sm:text-sm tracking-[0.2em] uppercase font-semibold text-[#FFF3B0]">
            Hitung Mundur Malam Anugerah
          </span>
        </div>

        {/* Timers Grid */}
        <div className="grid grid-cols-4 gap-2.5 sm:gap-4 text-center">
          {units.map((unit, idx) => (
            <div
              key={idx}
              className="group relative bg-[#071712]/80 border border-[#AFF8DB]/20 hover:border-[#AFF8DB]/50 rounded-2xl p-3 sm:p-4 transition-all duration-300 hover:shadow-[0_0_15px_rgba(175,248,219,0.2)]"
            >
              {/* Corner starlight accents */}
              <div className="absolute top-1.5 left-1.5 w-1 h-1 bg-[#FFF3B0]/60 rounded-full" />
              <div className="absolute top-1.5 right-1.5 w-1 h-1 bg-[#FFF3B0]/60 rounded-full" />

              <span className="font-cinzel font-black text-2xl sm:text-4xl lg:text-5xl text-[#AFF8DB] block tracking-tight text-glow-mint">
                {String(unit.value).padStart(2, '0')}
              </span>
              <span className="text-[10px] sm:text-xs font-semibold tracking-[0.2em] text-[#EDE8DF]/70 block mt-1">
                {unit.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

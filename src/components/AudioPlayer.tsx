'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Music, Sparkles } from 'lucide-react';

export default function AudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = new Audio('/sb_bringmethesky.mp3.mp3');
    audio.loop = true;
    audio.volume = 0.45;
    audioRef.current = audio;

    // Immediate autoplay attempt when website loads
    audio
      .play()
      .then(() => {
        setIsPlaying(true);
        setHasInteracted(true);
      })
      .catch(() => {
        // Fallback for browsers with strict autoplay policies: start on first movement/touch
      });

    const handleFirstInteraction = () => {
      if (audioRef.current && audioRef.current.paused) {
        audioRef.current
          .play()
          .then(() => {
            setIsPlaying(true);
            setHasInteracted(true);
          })
          .catch(() => {});
      }
      cleanupListeners();
    };

    const cleanupListeners = () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
      window.removeEventListener('scroll', handleFirstInteraction);
      window.removeEventListener('mousemove', handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };

    window.addEventListener('click', handleFirstInteraction, { passive: true });
    window.addEventListener('touchstart', handleFirstInteraction, { passive: true });
    window.addEventListener('scroll', handleFirstInteraction, { passive: true });
    window.addEventListener('mousemove', handleFirstInteraction, { passive: true, once: true });
    window.addEventListener('keydown', handleFirstInteraction, { passive: true });

    return () => {
      cleanupListeners();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setHasInteracted(true);
        })
        .catch((err) => console.warn('Audio play error:', err));
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 select-none">
      <div className="relative flex items-center justify-center group">
        
        {/* Tonearm needle of vinyl player */}
        <div
          className={`absolute -top-3 -right-1 z-30 transition-transform duration-500 origin-top-right pointer-events-none ${
            isPlaying ? 'rotate-[18deg]' : 'rotate-[-12deg]'
          }`}
        >
          <div className="w-1.5 h-7 bg-gradient-to-b from-[#FFF3B0] via-[#c4a24d] to-[#6d5520] rounded-full shadow-md relative">
            <div className="absolute top-0 right-0 w-3 h-3 rounded-full bg-[#3b2d13] border border-[#FFF3B0]/60 -mr-1" />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2.5 bg-[#AFF8DB] rounded-xs shadow-[0_0_8px_#AFF8DB]" />
          </div>
        </div>

        {/* Ambient Glow behind the vinyl disc */}
        <div
          className={`absolute inset-0 rounded-full transition-opacity duration-500 blur-md pointer-events-none ${
            isPlaying ? 'opacity-80 bg-[#AFF8DB]/30 scale-110 animate-pulse-glow' : 'opacity-0'
          }`}
        />

        {/* Vinyl Disc Button */}
        <button
          onClick={togglePlay}
          className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full cursor-pointer focus:outline-none transition-transform active:scale-95 shadow-2xl"
          title={isPlaying ? 'Klik untuk jeda musik (Pause)' : 'Klik untuk putar musik (Play)'}
          aria-label="Vinyl Record Audio Player"
        >
          {/* Rotating Vinyl Body */}
          <div
            className={`w-full h-full rounded-full bg-[#0d1411] border-2 border-[#1c382d] relative flex items-center justify-center overflow-hidden shadow-[inset_0_0_15px_rgba(0,0,0,0.9)] ${
              isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''
            }`}
          >
            {/* Vinyl grooved concentric rings */}
            <div className="absolute inset-1.5 rounded-full border border-white/10" />
            <div className="absolute inset-3 rounded-full border border-white/5" />
            <div className="absolute inset-4.5 rounded-full border border-white/10" />
            
            {/* Vinyl gloss reflection sheen */}
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-60 pointer-events-none" />

            {/* Center Label (Botanical Enchanted Theme) */}
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-gradient-to-br from-[#1b4b39] via-[#0e2d22] to-[#071711] border border-[#FFF3B0]/70 flex items-center justify-center relative shadow-inner">
              {isPlaying ? (
                <Sparkles className="w-3 h-3 text-[#FFF3B0] animate-pulse" />
              ) : (
                <Music className="w-3 h-3 text-[#AFF8DB]/80" />
              )}
              {/* Spindle hole */}
              <div className="w-1.5 h-1.5 rounded-full bg-[#050b08] border border-[#AFF8DB]/50 absolute" />
            </div>
          </div>
        </button>

        {/* Tooltip badge on hover */}
        <div className="absolute right-full mr-3 px-2.5 py-1 rounded-lg bg-[#0A1F18]/90 border border-[#AFF8DB]/30 text-[#EDE8DF] text-[10px] font-sans font-semibold tracking-wide whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none backdrop-blur-xs shadow-lg">
          {isPlaying ? 'Putar: Secret Garden OST' : 'Klik untuk Memutar'}
        </div>

      </div>
    </div>
  );
}

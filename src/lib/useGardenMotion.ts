'use client';

import { useEffect, useRef, useSyncExternalStore, type RefObject } from 'react';

function subscribeMedia(query: string) {
  return (callback: () => void) => {
    const mq = window.matchMedia(query);
    mq.addEventListener('change', callback);
    return () => mq.removeEventListener('change', callback);
  };
}

function getMediaSnapshot(query: string) {
  return () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false);
}

// Respect the user's motion preference.
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeMedia('(prefers-reduced-motion: reduce)'),
    getMediaSnapshot('(prefers-reduced-motion: reduce)'),
    () => false
  );
}

// Coarse-pointer / small-screen detection to lighten motion on mobile.
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMedia('(max-width: 768px), (pointer: coarse)'),
    getMediaSnapshot('(max-width: 768px), (pointer: coarse)'),
    () => false
  );
}

// Scroll parallax: translateY based on the element's position in the viewport.
export function useParallax<T extends HTMLElement>(strength = 0.2): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const reduced = usePrefersReducedMotion();
  const mobile = useIsMobile();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    const factor = mobile ? strength * 0.5 : strength;
    let raf = 0;

    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const viewport = window.innerHeight || 1;
      // -1 (below viewport) .. 0 (centered) .. 1 (above viewport)
      const progress = (rect.top + rect.height / 2 - viewport / 2) / viewport;
      el.style.transform = `translate3d(0, ${(progress * factor * 100).toFixed(2)}px, 0)`;
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      el.style.transform = '';
    };
  }, [strength, reduced, mobile]);

  return ref;
}

// Mouse parallax: element drifts based on pointer position across the window.
export function useMouseParallax<T extends HTMLElement>(strength = 20): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const reduced = usePrefersReducedMotion();
  const mobile = useIsMobile();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || mobile) return;

    const factor = strength;
    let raf = 0;
    let targetX = 0;
    let targetY = 0;

    const apply = () => {
      raf = 0;
      el.style.transform = `translate3d(${targetX.toFixed(2)}px, ${targetY.toFixed(2)}px, 0)`;
    };

    const onMove = (e: MouseEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5; // -0.5..0.5
      const ny = e.clientY / window.innerHeight - 0.5;
      targetX = -nx * factor;
      targetY = -ny * factor;
      if (!raf) raf = requestAnimationFrame(apply);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      el.style.transform = '';
    };
  }, [strength, reduced, mobile]);

  return ref;
}

export function useMouseProximity<T extends HTMLElement>(
  { radius = 240, maxScale = 1.12, maxRotate = 4 } = {}
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const reduced = usePrefersReducedMotion();
  const mobile = useIsMobile();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced || mobile) return;

    let raf = 0;
    let mouseX = -9999;
    let mouseY = -9999;

    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dist = Math.hypot(mouseX - cx, mouseY - cy);
      const prox = Math.max(0, 1 - dist / radius); // 0..1
      const scale = 1 + prox * (maxScale - 1);
      const rotate = ((mouseX - cx) / radius) * maxRotate * prox;
      el.style.transform = `scale(${scale.toFixed(3)}) rotate(${rotate.toFixed(2)}deg)`;
    };

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!raf) raf = requestAnimationFrame(update);
    };
    const onLeave = () => {
      mouseX = -9999;
      mouseY = -9999;
      if (!raf) raf = requestAnimationFrame(update);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
      el.style.transform = '';
    };
  }, [radius, maxScale, maxRotate, reduced, mobile]);

  return ref;
}

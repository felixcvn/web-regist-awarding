'use client';

import React from 'react';
import Image from 'next/image';
import Gate from './garden/Gate';
import HangingPot from './garden/HangingPot';
import Bush from './garden/Bush';
import Droop from './garden/Droop';
import Butterfly from './garden/Butterfly';
import { useParallax, useMouseProximity, useMouseParallax } from '@/lib/useGardenMotion';

// Raster (photoreal) garden assets in /public/garden.
export const GARDEN_IMAGES = {
  gateway: '/garden/Enchanted Wisteria Garden Gateway.webp',
  wisteriaBorder: '/garden/Hanging Wisteria Botanical Border (1).webp',
  wisteriaA: '/garden/Gemini_Generated_Image_l90c3rl90c3rl90c-Photoroom.webp',
  wisteriaB: '/garden/Gemini_Generated_Image_s1d10rs1d10rs1d1-Photoroom.webp',
  wisteriaC: '/garden/Gemini_Generated_Image_xgasnyxgasnyxgas-Photoroom.webp',
  scenePortrait: '/garden/Gemini_Generated_Image_s1tv9ys1tv9ys1tv.webp',
  butterfly: '/garden/download (71)-Photoroom.webp',
} as const;

export type GardenImageAsset = keyof typeof GARDEN_IMAGES;

// SVG fallback variants (used where no raster asset exists yet).
export type GardenSvgAsset = 'gate' | 'hanging' | 'bush' | 'droop' | 'butterfly';
export type GardenInteraction = 'none' | 'parallax' | 'hover' | 'sway' | 'swaySoft' | 'float';

interface RasterProps {
  /** Path to a raster asset (use GARDEN_IMAGES.*). */
  src: string;
  className?: string;
  interaction?: GardenInteraction;
  parallaxStrength?: number;
  mouseDepth?: number;
  priority?: boolean;
  alt?: string;
  /** Foreground depth-of-field blur in px. */
  blur?: number;
  objectFit?: 'contain' | 'cover';
}

function RasterGardenArtwork({
  src,
  className = '',
  interaction = 'none',
  parallaxStrength = 0.2,
  mouseDepth = 0,
  priority = false,
  alt = '',
  blur = 0,
  objectFit = 'contain',
}: RasterProps) {
  const parallaxRef = useParallax<HTMLDivElement>(parallaxStrength);
  const hoverRef = useMouseProximity<HTMLDivElement>();
  const mouseRef = useMouseParallax<HTMLDivElement>(mouseDepth);

  const ref =
    interaction === 'parallax'
      ? parallaxRef
      : interaction === 'hover'
      ? hoverRef
      : mouseDepth > 0
      ? mouseRef
      : undefined;

  const animClass =
    interaction === 'sway' ? 'animate-sway' : interaction === 'swaySoft' ? 'animate-sway-soft' : interaction === 'float' ? 'animate-flutter-fly' : '';

  return (
    <div ref={ref} aria-hidden="true" className={`pointer-events-none select-none ${animClass} ${className}`}>
      <Image
        src={src}
        alt={alt}
        width={1672}
        height={941}
        priority={priority}
        sizes="100vw"
        className={`w-full ${objectFit === 'cover' ? 'h-full object-cover' : 'h-auto object-contain'}`}
        style={blur ? { filter: `blur(${blur}px)` } : undefined}
      />
    </div>
  );
}

// Back-compat SVG renderer (kept for non-raster spots like small ornaments).
interface SvgProps {
  asset: GardenSvgAsset;
  className?: string;
  interaction?: GardenInteraction;
  parallaxStrength?: number;
  open?: number;
  mouseDepth?: number;
}

function SvgGardenArtwork({ asset, className = '', interaction = 'none', parallaxStrength = 0.2, open = 0, mouseDepth = 0 }: SvgProps) {
  const parallaxRef = useParallax<HTMLDivElement>(parallaxStrength);
  const hoverRef = useMouseProximity<HTMLDivElement>();
  const mouseRef = useMouseParallax<HTMLDivElement>(mouseDepth);

  const ref =
    interaction === 'parallax' ? parallaxRef : interaction === 'hover' ? hoverRef : mouseDepth > 0 ? mouseRef : undefined;

  const animClass = interaction === 'sway' ? 'animate-sway' : interaction === 'swaySoft' ? 'animate-sway-soft' : interaction === 'float' ? 'animate-flutter-fly' : '';
  const svgClass = 'w-full h-auto';

  return (
    <div ref={ref} aria-hidden="true" className={`pointer-events-none select-none ${animClass} ${className}`}>
      {asset === 'gate' && <Gate open={open} className={svgClass} />}
      {asset === 'hanging' && <HangingPot className={svgClass} />}
      {asset === 'bush' && <Bush className={svgClass} />}
      {asset === 'droop' && <Droop className={svgClass} />}
      {asset === 'butterfly' && <Butterfly className={svgClass} />}
    </div>
  );
}

type GardenArtworkProps = RasterProps | (SvgProps & { src?: undefined });

export default function GardenArtwork(props: GardenArtworkProps) {
  if ('src' in props && props.src) {
    return <RasterGardenArtwork {...(props as RasterProps)} />;
  }
  return <SvgGardenArtwork {...(props as SvgProps)} />;
}

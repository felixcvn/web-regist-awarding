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
  butterfly: '/garden/download (71)-Photoroom.webp',
  // Storybook garden elements (flat illustration, transparent bg)
  bushRight: '/garden/bush-right.png',
  grassRight: '/garden/grass-right.png',
  glowEllipse: '/garden/glow-ellipse.png',
  clusterSmall1: '/garden/cluster-small-1.png',
  clusterSmall2: '/garden/cluster-small-2.png',
  clusterSmall3: '/garden/cluster-small-3.png',
  clusterBig1: '/garden/cluster-big-1.png',
  clusterBig2: '/garden/cluster-big-2.png',
  flowerCream: '/garden/flower-cream.png',
  flowerPink: '/garden/flower-pink.png',
  flowerMini: '/garden/flower-mini.png',
  flowerMini2: '/garden/flower-mini-2.png',
  flowerSoft: '/garden/flower-soft.png',
} as const;

export type GardenImageAsset = keyof typeof GARDEN_IMAGES;

// Intrinsic dimensions so next/image keeps each asset's real aspect ratio.
export const GARDEN_DIMS: Record<string, { width: number; height: number }> = {
  [GARDEN_IMAGES.butterfly]: { width: 674, height: 1263 },
  [GARDEN_IMAGES.bushRight]: { width: 394, height: 1190 },
  [GARDEN_IMAGES.grassRight]: { width: 442, height: 1190 },
  [GARDEN_IMAGES.glowEllipse]: { width: 601, height: 741 },
  [GARDEN_IMAGES.clusterSmall1]: { width: 226, height: 358 },
  [GARDEN_IMAGES.clusterSmall2]: { width: 326, height: 258 },
  [GARDEN_IMAGES.clusterSmall3]: { width: 155, height: 237 },
  [GARDEN_IMAGES.clusterBig1]: { width: 368, height: 605 },
  [GARDEN_IMAGES.clusterBig2]: { width: 343, height: 624 },
  [GARDEN_IMAGES.flowerCream]: { width: 277, height: 274 },
  [GARDEN_IMAGES.flowerPink]: { width: 214, height: 192 },
  [GARDEN_IMAGES.flowerMini]: { width: 140, height: 140 },
  [GARDEN_IMAGES.flowerMini2]: { width: 140, height: 140 },
  [GARDEN_IMAGES.flowerSoft]: { width: 201, height: 202 },
};

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
        width={GARDEN_DIMS[src]?.width ?? 512}
        height={GARDEN_DIMS[src]?.height ?? 512}
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

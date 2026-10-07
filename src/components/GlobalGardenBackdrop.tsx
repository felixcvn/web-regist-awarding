'use client';

import React from 'react';
import GardenArtwork, { GARDEN_IMAGES } from './GardenArtwork';

export default function GlobalGardenBackdrop() {
  return (
    <>
      {/* Fixed gateway backdrop locked to the viewport, content scrolls over it */}
      <GardenArtwork
        src={GARDEN_IMAGES.gateway}
        objectFit="cover"
        priority
        className="fixed inset-0 z-0 w-full h-full"
      />
      {/* Soft vignette scrim to keep content readable over the gateway photo */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-surface-base/60 via-surface-base/40 to-surface-base/80" />
    </>
  );
}
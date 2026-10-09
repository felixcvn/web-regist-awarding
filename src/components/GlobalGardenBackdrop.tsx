'use client';

import React from 'react';
import GardenArtwork, { GARDEN_IMAGES } from './GardenArtwork';

export default function GlobalGardenBackdrop() {
  return (
    <>
      {/* Soft glow blooms — the dark gradient carries the mood, foliage lives in GardenFrame */}
      <GardenArtwork
        src={GARDEN_IMAGES.glowEllipse}
        className="fixed -bottom-6 left-1/4 w-72 sm:w-96 z-0 opacity-30"
      />
      <GardenArtwork
        src={GARDEN_IMAGES.glowEllipse}
        className="fixed -top-10 right-[8%] w-64 sm:w-80 z-0 opacity-25"
      />
    </>
  );
}
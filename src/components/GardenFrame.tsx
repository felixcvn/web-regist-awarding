'use client';

import React from 'react';
import GardenArtwork, { GARDEN_IMAGES } from './GardenArtwork';

interface GardenFrameProps {
  /** subtle = slightly smaller & dimmer frame for secondary pages */
  variant?: 'full' | 'subtle';
}

export default function GardenFrame({ variant = 'full' }: GardenFrameProps) {
  const isSubtle = variant === 'subtle';

  // Bush is ~1:3 tall; max() keeps its crest above the viewport top on any
  // screen ratio so the cropped edge of the PNG never shows.
  const bushW = isSubtle ? 'w-[max(18vw,32vh)]' : 'w-[max(21vw,38vh)]';
  const grassW = isSubtle ? 'w-[max(11vw,20vh)]' : 'w-[max(13vw,24vh)]';
  const glowW = isSubtle ? 'w-[20vw]' : 'w-[24vw]';
  // Grass crest sits mid-screen; fade its top edge so it melts into the dark.
  const grassFade = '[mask-image:linear-gradient(to_bottom,transparent_0,black_22%)]';

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 hidden lg:block ${
        isSubtle ? 'opacity-55' : 'opacity-95'
      }`}
    >
      {/* ── LEFT SIDE ── */}
      {/* glow rising from behind the foliage */}
      <GardenArtwork
        src={GARDEN_IMAGES.glowEllipse}
        className={`fixed -bottom-[6vh] -left-[6vw] ${glowW} opacity-40`}
      />
      {/* back layer: grass, inset toward center, faded crest */}
      <GardenArtwork
        src={GARDEN_IMAGES.grassRight}
        interaction="swaySoft"
        className={`fixed -bottom-2 left-[6vw] ${grassW} origin-bottom opacity-75 scale-x-[-1] ${grassFade}`}
      />
      {/* front layer: tall bush hugging the corner, crest runs past the top */}
      <GardenArtwork
        src={GARDEN_IMAGES.bushRight}
        className={`fixed -bottom-2 -left-4 ${bushW} origin-bottom scale-x-[-1]`}
      />
      {/* dressing: flower hugging the bush body */}
      <GardenArtwork
        src={GARDEN_IMAGES.flowerPink}
        interaction="swaySoft"
        className="fixed bottom-[30vh] left-[1vw] w-[5vw] origin-bottom scale-x-[-1]"
      />
      {/* dressing: cluster drifting near the grass crest */}
      <GardenArtwork
        src={GARDEN_IMAGES.clusterSmall2}
        interaction="float"
        className="fixed bottom-[54vh] left-[8vw] w-[5vw]"
      />
      {/* dressing: tiny bloom at the roots */}
      <GardenArtwork
        src={GARDEN_IMAGES.flowerSoft}
        className="fixed bottom-[12vh] left-[9vw] w-[3vw] opacity-70"
      />

      {/* ── RIGHT SIDE (mirrored, loosely varied) ── */}
      <GardenArtwork
        src={GARDEN_IMAGES.glowEllipse}
        className={`fixed -bottom-[8vh] -right-[7vw] ${glowW} opacity-40`}
      />
      <GardenArtwork
        src={GARDEN_IMAGES.grassRight}
        interaction="swaySoft"
        className={`fixed -bottom-2 right-[7vw] ${grassW} origin-bottom opacity-75 ${grassFade}`}
      />
      <GardenArtwork
        src={GARDEN_IMAGES.bushRight}
        className={`fixed -bottom-2 -right-4 ${bushW} origin-bottom`}
      />
      <GardenArtwork
        src={GARDEN_IMAGES.flowerCream}
        interaction="swaySoft"
        className="fixed bottom-[34vh] right-[1vw] w-[4.5vw] origin-bottom"
      />
      <GardenArtwork
        src={GARDEN_IMAGES.clusterBig2}
        interaction="float"
        className="fixed bottom-[50vh] right-[8vw] w-[6vw]"
      />
      <GardenArtwork
        src={GARDEN_IMAGES.flowerMini2}
        className="fixed bottom-[14vh] right-[10vw] w-[2.5vw] opacity-70"
      />

      {/* floating glow wisps mid-screen for extra liveliness */}
      <GardenArtwork
        src={GARDEN_IMAGES.glowEllipse}
        className="fixed top-[14vh] left-[16vw] w-[9vw] opacity-20"
      />
      <GardenArtwork
        src={GARDEN_IMAGES.glowEllipse}
        className="fixed top-[22vh] right-[15vw] w-[7vw] opacity-15"
      />
    </div>
  );
}
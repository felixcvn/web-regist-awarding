import React from 'react';

// 1. Royal Botanical Corner Filigree (Gold & Mint Luxury Engraving)
export function BotanicalCornerFiligree({
  position = 'top-left',
  className = '',
}: {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
}) {
  const isRight = position.includes('right');
  const isBottom = position.includes('bottom');

  return (
    <div
      className={`absolute pointer-events-none select-none z-10 w-28 sm:w-44 lg:w-56 animate-gentle-sway ${
        isBottom ? 'bottom-0' : 'top-0'
      } ${isRight ? 'right-0 -scale-x-100' : 'left-0'} ${
        isBottom ? '-scale-y-100' : ''
      } ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-[0_0_15px_rgba(175,248,219,0.35)]"
      >
        <defs>
          <linearGradient id="goldMintGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFF3B0" stopOpacity="0.9" />
            <stop offset="60%" stopColor="#AFF8DB" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#2D7A58" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="leafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#AFF8DB" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#144234" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Primary Graceful Branch Spine */}
        <path
          d="M0,8 C60,12 110,40 150,85 C185,125 210,180 225,240"
          stroke="url(#goldMintGrad)"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Secondary Delicate Tendril */}
        <path
          d="M10,0 C25,50 65,95 115,125 C160,150 195,165 240,175"
          stroke="url(#goldMintGrad)"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeDasharray="4 2"
          opacity="0.6"
        />

        {/* Curling Whisper Vine 1 */}
        <path
          d="M80,50 C110,40 135,15 125,2 C115,-8 95,15 105,35"
          stroke="#FFF3B0"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
          className="animate-gentle-sway"
          style={{ transformOrigin: '80px 50px' }}
        />

        {/* Curling Whisper Vine 2 */}
        <path
          d="M140,105 C170,105 195,85 190,65 C182,50 160,65 170,88"
          stroke="#AFF8DB"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.8"
          className="animate-gentle-sway"
          style={{ transformOrigin: '140px 105px', animationDelay: '1s' }}
        />

        {/* Organic Royal Leaves along the stem */}
        {/* Leaf 1 */}
        <path
          d="M45,20 C60,15 75,25 70,38 C60,42 48,32 45,20 Z"
          fill="url(#leafGrad)"
          stroke="#FFF3B0"
          strokeWidth="0.8"
          className="animate-leaf-flutter"
          style={{ transformOrigin: '45px 20px', animationDelay: '0.2s' }}
        />
        {/* Leaf 2 */}
        <path
          d="M85,55 C105,45 120,60 115,75 C100,78 88,68 85,55 Z"
          fill="url(#leafGrad)"
          stroke="#AFF8DB"
          strokeWidth="0.8"
          className="animate-leaf-flutter"
          style={{ transformOrigin: '85px 55px', animationDelay: '0.7s' }}
        />
        {/* Leaf 3 */}
        <path
          d="M125,98 C148,90 162,108 155,124 C140,126 128,114 125,98 Z"
          fill="url(#leafGrad)"
          stroke="#FFF3B0"
          strokeWidth="0.8"
          className="animate-leaf-flutter"
          style={{ transformOrigin: '125px 98px', animationDelay: '1.2s' }}
        />
        {/* Leaf 4 */}
        <path
          d="M165,150 C188,145 198,165 190,180 C175,182 165,168 165,150 Z"
          fill="url(#leafGrad)"
          stroke="#AFF8DB"
          strokeWidth="0.8"
          className="animate-leaf-flutter"
          style={{ transformOrigin: '165px 150px', animationDelay: '1.8s' }}
        />

        {/* Starlight Buds / Dewdrops */}
        <circle cx="125" cy="2" r="2.5" fill="#FFF3B0" className="animate-pulse" />
        <circle cx="190" cy="65" r="2" fill="#AFF8DB" className="animate-pulse" />
        <circle cx="70" cy="38" r="1.5" fill="#FFB5E8" />
        <circle cx="155" cy="124" r="1.5" fill="#FFB5E8" />
      </svg>
    </div>
  );
}

// 2. Royal Botanical Archway (Spans across the Hero or Gateway)
export function RoyalGardenArch({ className = '' }: { className?: string }) {
  return (
    <div
      className={`absolute top-0 inset-x-0 pointer-events-none select-none z-10 overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1200 220"
        fill="none"
        preserveAspectRatio="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto drop-shadow-[0_0_20px_rgba(175,248,219,0.25)]"
      >
        <defs>
          <linearGradient id="archGoldMint" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#FFF3B0" stopOpacity="0.85" />
            <stop offset="25%" stopColor="#AFF8DB" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#FFF3B0" stopOpacity="0.4" />
            <stop offset="75%" stopColor="#AFF8DB" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#FFF3B0" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="archLeafGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#AFF8DB" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#124032" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Sweeping Botanical Arch Spine */}
        <path
          d="M0,20 Q300,110 600,105 Q900,110 1200,20"
          stroke="url(#archGoldMint)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />

        {/* Sub-arch with graceful dip */}
        <path
          d="M0,5 Q300,80 600,75 Q900,80 1200,5"
          stroke="url(#archGoldMint)"
          strokeWidth="0.8"
          strokeDasharray="6 3"
          opacity="0.5"
        />

        {/* Left Botanical Cluster */}
        <g className="animate-leaf-flutter">
          <path d="M120,55 C145,50 160,70 150,85 C135,88 122,72 120,55 Z" fill="url(#archLeafGrad)" stroke="#FFF3B0" strokeWidth="0.8" />
          <path d="M220,80 C245,78 258,95 250,108 C235,110 225,95 220,80 Z" fill="url(#archLeafGrad)" stroke="#AFF8DB" strokeWidth="0.8" />
          <path d="M340,95 C360,95 370,110 362,122 C350,122 342,108 340,95 Z" fill="url(#archLeafGrad)" stroke="#FFF3B0" strokeWidth="0.8" />
        </g>

        {/* Right Botanical Cluster */}
        <g className="animate-leaf-flutter" style={{ animationDelay: '1.5s' }}>
          <path d="M1080,55 C1055,50 1040,70 1050,85 C1065,88 1078,72 1080,55 Z" fill="url(#archLeafGrad)" stroke="#FFF3B0" strokeWidth="0.8" />
          <path d="M980,80 C955,78 942,95 950,108 C965,110 975,95 980,80 Z" fill="url(#archLeafGrad)" stroke="#AFF8DB" strokeWidth="0.8" />
          <path d="M860,95 C840,95 830,110 838,122 C850,122 858,108 860,95 Z" fill="url(#archLeafGrad)" stroke="#FFF3B0" strokeWidth="0.8" />
        </g>

        {/* Central Starlight Bloom */}
        <circle cx="600" cy="105" r="3.5" fill="#FFF3B0" className="animate-pulse" />
        <circle cx="580" cy="103" r="1.5" fill="#AFF8DB" />
        <circle cx="620" cy="103" r="1.5" fill="#AFF8DB" />
      </svg>
    </div>
  );
}

// 3. Delicate Hanging Fairy Lantern
export function Lantern({ className = '' }: { className?: string }) {
  return (
    <div className={`relative flex flex-col items-center pointer-events-none select-none animate-lantern-swing ${className}`}>
      {/* Slender Golden Chain */}
      <div className="w-[1.2px] h-14 sm:h-20 bg-gradient-to-b from-[#FFF3B0]/10 via-[#FFF3B0]/70 to-[#d4af37] shadow-[0_0_8px_rgba(255,243,176,0.6)]" />
      
      {/* Ornate Gold Filigree Cap */}
      <div className="w-7 sm:w-9 h-2.5 bg-gradient-to-b from-[#755d21] via-[#4d3b12] to-[#241a08] rounded-t-full border-t border-[#FFF3B0]/80 relative shadow-md">
        <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-2.5 h-1.5 rounded-full border border-[#FFF3B0]/70" />
      </div>
      
      {/* Glass Body with Warm Starlight Glow */}
      <div className="w-6 sm:w-8 h-9 sm:h-11 bg-gradient-to-b from-[#FFF3B0]/25 via-[#FFE79A]/15 to-[#AFF8DB]/10 rounded-b-lg border border-[#FFF3B0]/75 backdrop-blur-md flex items-center justify-center relative overflow-hidden shadow-[0_0_35px_rgba(255,243,176,0.85)]">
        {/* Pulsing Core Starlight */}
        <div className="w-3 sm:w-4 h-4 sm:h-5 bg-[#FFF3B0] rounded-full blur-[1.5px] animate-pulse shadow-[0_0_20px_#FFF3B0]" />
        {/* Soft bioluminescent aura */}
        <div className="absolute inset-0 bg-[#AFF8DB]/10" />
      </div>
      
      {/* Brass Bottom Finial */}
      <div className="w-2 h-1.5 bg-[#3b2b0e] rounded-b" />
      <div className="w-0.5 h-2.5 bg-[#b5984b]" />
    </div>
  );
}

// 4. Starlight Glow backdrop
export function StarlightGlow({ className = '' }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none select-none rounded-full blur-3xl ${className}`}
      aria-hidden="true"
    />
  );
}

// 5. Card Floral Crest for Section Headers & Philosophy Cards
export function BotanicalCardAccent({
  position = 'top-right',
  className = '',
}: {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  className?: string;
}) {
  return <BotanicalCornerFiligree position={position} className={className} />;
}

// Compatibility stubs so no import breaks
export function BlendedBotanical() {
  return null;
}
export function BotanicalPlantSprig() {
  return null;
}
export function EnchantedGardenArch() {
  return null;
}
export function SecretGardenVine() {
  return null;
}
export function BotanicalBranch() {
  return null;
}
export function BotanicalPlant() {
  return null;
}

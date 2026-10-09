import { notFound } from 'next/navigation';
import { getParticipantByToken } from '@/lib/db';
import TicketCard from '@/components/TicketCard';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Enchanted3DCanvas from '@/components/Enchanted3DCanvas';
import GardenArtwork, { GARDEN_IMAGES } from '@/components/GardenArtwork';
import GlobalGardenBackdrop from '@/components/GlobalGardenBackdrop';
import GardenFrame from '@/components/GardenFrame';

interface TicketPageProps {
  params: Promise<{ id: string }>;
}

export default async function TicketPage({ params }: TicketPageProps) {
  const resolvedParams = await params;
  const participant = await getParticipantByToken(resolvedParams.id);

  if (!participant) {
    notFound();
  }

  return (
    <main className="section-shade relative min-h-screen bg-transparent text-ink flex flex-col justify-between selection:bg-bloom-pink selection:text-on-accent overflow-hidden">
      <GlobalGardenBackdrop />
      <GardenFrame variant="subtle" />
      <Enchanted3DCanvas />
      {/* Soft glow behind the ticket + flower accent */}
      <GardenArtwork
        src={GARDEN_IMAGES.glowEllipse}
        className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[480px] sm:w-[640px] z-0 opacity-25"
      />
      <GardenArtwork
        src={GARDEN_IMAGES.flowerPink}
        interaction="swaySoft"
        className="absolute top-32 left-[10%] w-12 sm:w-16 z-10 origin-bottom opacity-80"
      />
      <Navbar />
      <div className="pt-28 pb-20 px-4 sm:px-6 lg:px-8 flex-1 flex items-center justify-center relative z-20">
        <TicketCard participant={participant} />
      </div>
      <Footer />
    </main>
  );
}

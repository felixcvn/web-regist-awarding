import { notFound } from 'next/navigation';
import { getParticipantByToken } from '@/lib/db';
import TicketCard from '@/components/TicketCard';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Enchanted3DCanvas from '@/components/Enchanted3DCanvas';
import GardenArtwork from '@/components/GardenArtwork';

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
    <main className="relative min-h-screen bg-garden bg-vignette-soft text-ink flex flex-col justify-between selection:bg-bloom-pink selection:text-on-accent overflow-hidden">
      <Enchanted3DCanvas />
      <GardenArtwork asset="droop" interaction="sway" className="absolute -top-6 sm:-top-8 left-1/2 -translate-x-1/2 w-[52vw] sm:w-[380px] z-10 opacity-70 origin-top" />
      <GardenArtwork asset="bush" interaction="hover" className="absolute bottom-0 left-2 sm:left-6 w-40 sm:w-56 z-10 origin-bottom opacity-70" />
      <GardenArtwork asset="bush" interaction="hover" className="absolute bottom-0 right-2 sm:right-6 w-40 sm:w-56 z-10 origin-bottom scale-x-[-1] opacity-70" />
      <GardenArtwork asset="butterfly" interaction="float" className="absolute top-40 right-[14%] w-7 sm:w-9 z-10 opacity-80" />
      <Navbar />
      <div className="pt-28 pb-20 px-4 sm:px-6 lg:px-8 flex-1 flex items-center justify-center relative z-20">
        <TicketCard participant={participant} />
      </div>
      <Footer />
    </main>
  );
}

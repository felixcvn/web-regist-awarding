import { notFound } from 'next/navigation';
import { getParticipantByToken } from '@/lib/db';
import TicketCard from '@/components/TicketCard';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Enchanted3DCanvas from '@/components/Enchanted3DCanvas';
import GardenArtwork, { GARDEN_IMAGES } from '@/components/GardenArtwork';
import GardenFrame from '@/components/GardenFrame';
import { qrTokenSchema } from '@/lib/validation';

export const dynamic = 'force-dynamic';

interface TicketPageProps {
  params: Promise<{ id: string }>;
}

export default async function TicketPage({ params }: TicketPageProps) {
  const resolvedParams = await params;
  const token = qrTokenSchema.safeParse(resolvedParams.id);
  if (!token.success) notFound();
  const participant = await getParticipantByToken(token.data);

  if (!participant) {
    notFound();
  }

  return (
    <main className="relative min-h-screen bg-transparent text-ink flex flex-col justify-between selection:bg-bloom-pink selection:text-on-accent overflow-hidden">
      <GardenFrame variant="subtle" />
      <Enchanted3DCanvas />
      {/* Flower accent */}
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

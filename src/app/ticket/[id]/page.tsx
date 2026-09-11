import { notFound } from 'next/navigation';
import { getParticipantByToken } from '@/lib/db';
import TicketCard from '@/components/TicketCard';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Enchanted3DCanvas from '@/components/Enchanted3DCanvas';

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
    <main className="min-h-screen bg-[#061510] text-[#EDE8DF] flex flex-col justify-between selection:bg-[#AFF8DB] selection:text-[#061510] relative">
      <Enchanted3DCanvas />
      <Navbar />
      <div className="pt-28 pb-20 px-4 sm:px-6 lg:px-8 flex-1 flex items-center justify-center relative z-20">
        <TicketCard participant={participant} />
      </div>
      <Footer />
    </main>
  );
}

import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import EventDetails from '@/components/EventDetails';
import PastInsights from '@/components/PastInsights';
import Gallery from '@/components/Gallery';
import RegistrationClosed from '@/components/RegistrationClosed';
import Footer from '@/components/Footer';
import Enchanted3DCanvas from '@/components/Enchanted3DCanvas';
import GardenFrame from '@/components/GardenFrame';

export default function Home() {
  return (
    <main className="min-h-screen bg-garden text-ink selection:bg-bloom-pink selection:text-on-accent overflow-x-hidden relative">
      {/* Storybook foliage framing the viewport, cover-proposal style */}
      <GardenFrame />
      <Enchanted3DCanvas />
      <Navbar />
      <Hero />
      <EventDetails />
      <PastInsights />
      <Gallery />
      <RegistrationClosed />
      <Footer />
    </main>
  );
}

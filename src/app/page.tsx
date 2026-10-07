import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import EventDetails from '@/components/EventDetails';
import PastInsights from '@/components/PastInsights';
import Gallery from '@/components/Gallery';
import RegistrationForm from '@/components/RegistrationForm';
import Footer from '@/components/Footer';
import Enchanted3DCanvas from '@/components/Enchanted3DCanvas';
import GlobalGardenBackdrop from '@/components/GlobalGardenBackdrop';

export default function Home() {
  return (
    <main className="min-h-screen bg-garden text-ink selection:bg-bloom-pink selection:text-on-accent overflow-x-hidden relative">
      {/* Global garden backdrop: fixed gateway + vignette, behind everything */}
      <GlobalGardenBackdrop />
      <Enchanted3DCanvas />
      <Navbar />
      <Hero />
      <EventDetails />
      <PastInsights />
      <Gallery />
      <RegistrationForm />
      <Footer />
    </main>
  );
}


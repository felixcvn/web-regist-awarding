import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import EventDetails from '@/components/EventDetails';
import PastInsights from '@/components/PastInsights';
import Gallery from '@/components/Gallery';
import RegistrationForm from '@/components/RegistrationForm';
import Footer from '@/components/Footer';
import Enchanted3DCanvas from '@/components/Enchanted3DCanvas';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#071510] text-[#EDE8DF] selection:bg-[#AFF8DB] selection:text-[#061510] overflow-x-hidden relative">
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


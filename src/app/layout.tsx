import type { Metadata } from "next";
import "./globals.css";
import AudioPlayer from "@/components/AudioPlayer";

export const metadata: Metadata = {
  title: "Fasilkom Awarding Night 2026 | Secret Garden: Dreams to History",
  description: "Undangan Resmi & Registrasi Kehadiran Fasilkom Awarding Night 2026. Mengusung tema 'Secret Garden: Dreams to History' — Ruang bertumbuhnya mimpi civitas Fasilkom UNEJ yang mekar menjadi torehan sejarah membanggakan.",
  keywords: ["Fasilkom", "Awarding Night", "UNEJ", "Secret Garden", "Dreams to History", "Malam Apresiasi"],
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="scroll-smooth">
      <body className="font-sans antialiased bg-[#071510] text-[#EDE8DF] selection:bg-[#AFF8DB] selection:text-[#061510] min-h-screen relative">
        {children}
        <AudioPlayer />
      </body>
    </html>
  );
}

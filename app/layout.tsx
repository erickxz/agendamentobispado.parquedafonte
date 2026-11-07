import type { Metadata, Viewport } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import "./globals.css";

const serif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["600"],
  variable: "--font-source-serif",
  display: "swap",
});

const sans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-source-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Marcar entrevista com o bispado · Ala Parque da Fonte",
  description: "Agendamento de entrevistas com o bispado da Ala Parque da Fonte, São José dos Pinhais – PR.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#12233A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <div className="page">
          <Header />
          <div className="page-content">{children}</div>
          <Footer />
        </div>
      </body>
    </html>
  );
}

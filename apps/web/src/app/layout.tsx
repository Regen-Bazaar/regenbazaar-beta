import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { Nav } from "../components/Nav";
import { Providers } from "../components/Providers";
import "./globals.css";

// Brand fonts (self-hosted, from the landing site): EB Garamond = body serif, PP Acma = display.
const ebGaramond = localFont({
  src: "./fonts/eb-garamond.ttf",
  variable: "--font-eb",
  display: "swap",
});
const ppAcma = localFont({
  src: "./fonts/pp-acma.ttf",
  variable: "--font-acma",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Regen Bazaar",
  description:
    "We turn verified real-world impact into a tradable asset class — for NGOs to tokenize impact and for buyers to fund it.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${ebGaramond.variable} ${ppAcma.variable}`}>
      <body className="min-h-screen antialiased">
        <Providers>
          <Nav />
          {children}
        </Providers>
      </body>
    </html>
  );
}

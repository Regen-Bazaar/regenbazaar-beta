import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { Nav } from "../components/Nav";
import { Providers } from "../components/Providers";
import { currentNetwork } from "../lib/network-server";
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

const THEME_SCRIPT = `(function(){var t;try{t=localStorage.getItem("rb-theme")}catch(e){}
if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}
document.documentElement.dataset.theme=t})()`;

export const metadata: Metadata = {
  title: "Regen Bazaar",
  description:
    "We turn verified real-world impact into a tradable asset class — for NGOs to tokenize impact and for buyers to fund it.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const network = await currentNetwork();
  return (
    <html lang="en" className={`${ebGaramond.variable} ${ppAcma.variable}`} suppressHydrationWarning>
      <head>
        {/* Resolve the theme before first paint: saved choice, else the system setting. Static string, no user data. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <Providers networkKey={network.key}>
          <Nav />
          {children}
        </Providers>
      </body>
    </html>
  );
}

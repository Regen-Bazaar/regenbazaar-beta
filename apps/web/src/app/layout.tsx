import type { Metadata } from "next";
import { SITE_URL } from "../lib/site";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { Footer } from "../components/Footer";
import { Nav, TabBar } from "../components/Nav";
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

const DESCRIPTION =
  "We turn verified real-world impact into a tradable asset class, for creators to tokenize impact and for buyers to purchase it. Testnet beta.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Regen Bazaar", template: "%s · Regen Bazaar" },
  description: DESCRIPTION,
  applicationName: "Regen Bazaar",
  openGraph: {
    type: "website",
    siteName: "Regen Bazaar",
    title: "Regen Bazaar",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image", site: "@RegenBazaar", title: "Regen Bazaar", description: DESCRIPTION },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const network = await currentNetwork();
  return (
    <html lang="en" className={`${ebGaramond.variable} ${ppAcma.variable}`} suppressHydrationWarning>
      <body className="flex min-h-screen flex-col antialiased">
        <Providers networkKey={network.key}>
          <Nav />
          <div className="flex-1">{children}</div>
          <Footer />
          {/* Room for the fixed phone tab bar, so it never covers the end of the page. */}
          <div className="h-[calc(56px+env(safe-area-inset-bottom))] lg:hidden" aria-hidden="true" />
          <TabBar />
        </Providers>
      </body>
    </html>
  );
}

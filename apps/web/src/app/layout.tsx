import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { Footer } from "../components/Footer";
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

const DESCRIPTION =
  "We turn verified real-world impact into a tradable asset class, for NGOs to tokenize impact and for funders to back it. Testnet beta.";

export const metadata: Metadata = {
  metadataBase: new URL("https://app.regenbazaar.com"),
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
        {/* Resolve the theme before first paint: saved choice, else the system setting. Static string, no user data.
            First child of <body>, not in <head>: a hand-written <head> script is the suspected cause of React error #418. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <Providers networkKey={network.key}>
          <Nav />
          <div className="flex-1">{children}</div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}

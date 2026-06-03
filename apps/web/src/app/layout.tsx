import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Regen Bazaar",
  description:
    "We turn verified real-world impact into a tradable asset class — for NGOs to tokenize impact and for buyers to fund it.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

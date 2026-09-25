import type { ReactNode } from "react";

// Reviewer-only page: keep it out of search results.
export const metadata = {
  title: "Verification queue",
  robots: { index: false, follow: false },
};

export default function VerifyLayout({ children }: { children: ReactNode }) {
  return children;
}

import Link from "next/link";
import { ConnectButton } from "./ConnectButton";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tokenize", label: "Tokenize impact" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/methodology", label: "Methodology" },
  { href: "/verify", label: "Verify" },
];

export function Nav() {
  return (
    <header className="border-b border-gold/20 bg-ink-soft/40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Regen <span className="text-gold">Bazaar</span>
        </Link>

        <div className="flex items-center gap-4">
          {/* desktop */}
          <nav className="hidden gap-7 text-sm sm:flex">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-paper/75 transition-colors hover:text-gold">
                {l.label}
              </Link>
            ))}
          </nav>

          <ConnectButton />

          {/* mobile (no-JS disclosure) */}
          <details className="relative sm:hidden">
          <summary className="cursor-pointer list-none rounded-md border border-gold/30 px-3 py-1.5 text-sm text-paper/80">
            Menu
          </summary>
          <nav className="absolute right-0 z-20 mt-2 flex w-52 flex-col gap-1 rounded-md border border-gold/20 bg-ink-soft p-2 text-sm shadow-lg">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded px-3 py-2 text-paper/80 hover:bg-ink hover:text-gold">
                {l.label}
              </Link>
            ))}
          </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

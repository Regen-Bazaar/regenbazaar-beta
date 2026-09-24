import Link from "next/link";
import { ConnectButton } from "./ConnectButton";
import { NETWORK, otherDeployments } from "../lib/networks";

const OTHER = otherDeployments(NETWORK.key);

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tokenize", label: "Tokenize impact" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/portfolio", label: "My impact" },
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
          <details className="relative hidden xl:block">
            <summary
              title="Active network"
              className="cursor-pointer list-none whitespace-nowrap rounded-full border border-gold/30 px-2.5 py-1 text-xs text-paper/70"
            >
              {NETWORK.chain.name} · {NETWORK.saleCurrency.symbol}
            </summary>
            {OTHER.length > 0 && (
              <div className="absolute left-0 z-20 mt-2 w-60 rounded-md border border-gold/20 bg-ink-soft p-2 text-xs shadow-lg">
                <p className="px-2 pb-1 text-paper/45">Also live on</p>
                {OTHER.map((o) => (
                  <a key={o.url} href={o.url} className="block rounded px-2 py-1.5 text-paper/80 hover:bg-ink hover:text-gold">
                    {o.name} →
                  </a>
                ))}
              </div>
            )}
          </details>
          {/* desktop */}
          <nav className="hidden gap-6 whitespace-nowrap text-sm lg:flex">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-paper/75 transition-colors hover:text-gold">
                {l.label}
              </Link>
            ))}
          </nav>

          <ConnectButton />

          {/* mobile (no-JS disclosure) */}
          <details className="relative lg:hidden">
          <summary className="cursor-pointer list-none rounded-md border border-gold/30 px-3 py-1.5 text-sm text-paper/80">
            Menu
          </summary>
          <nav className="absolute right-0 z-20 mt-2 flex w-52 flex-col gap-1 rounded-md border border-gold/20 bg-ink-soft p-2 text-sm shadow-lg">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded px-3 py-2 text-paper/80 hover:bg-ink hover:text-gold">
                {l.label}
              </Link>
            ))}
            <p className="mt-1 border-t border-gold/15 px-3 pt-2 text-xs text-paper/50">Network: {NETWORK.chain.name}</p>
            {OTHER.map((o) => (
              <a key={o.url} href={o.url} className="rounded px-3 py-2 text-xs text-paper/70 hover:bg-ink hover:text-gold">
                Switch to {o.name} →
              </a>
            ))}
          </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

import Link from "next/link";
import { Logo } from "./Logo";

const PRODUCT = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/tokenize", label: "Tokenize impact" },
  { href: "/portfolio", label: "My impact" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leaderboard", label: "Leaderboard" },
];
const LEARN = [
  { href: "/guide", label: "How to try the demo" },
  { href: "/methodology", label: "Impact Value methodology" },
  { href: "/roadmap", label: "Roadmap" },
];
const ELSEWHERE = [
  { href: "https://www.regenbazaar.com", label: "regenbazaar.com" },
  { href: "https://x.com/RegenBazaar", label: "X (Twitter)" },
  { href: "https://t.me/regen_bazaar", label: "Telegram" },
  { href: "https://github.com/Regen-Bazaar/regenbazaar-beta", label: "GitHub" },
];

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="page-wrap grid gap-10 py-14 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div className="max-w-sm">
          <Link href="/" className="flex items-center gap-3" aria-label="Regen Bazaar home">
            <Logo className="h-6 w-auto text-fg" />
            <span className="font-display text-[22px]">
              Regen <span className="text-accent">Bazaar</span>
            </span>
          </Link>
          <p className="mt-4 text-muted">
            Verified real-world impact as a tradable asset class, for NGOs and the people who fund them.
          </p>
          <p className="mt-4 text-sm text-subtle">
            Testnet beta: test networks and test tokens only, no real money moves. Impact Value is platform-assessed,
            not third-party certified.
          </p>
        </div>
        <FooterCol title="Product" links={PRODUCT} />
        <FooterCol title="Learn" links={LEARN} />
        <FooterCol title="Elsewhere" links={ELSEWHERE} external />
      </div>
    </footer>
  );
}

function FooterCol({ title, links, external }: { title: string; links: { href: string; label: string }[]; external?: boolean }) {
  return (
    <nav aria-label={title}>
      <h2 className="label-mono">{title}</h2>
      <ul className="mt-4 space-y-2.5">
        {links.map((l) => (
          <li key={l.href}>
            {external ? (
              <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-muted hover:text-accent">
                {l.label} ↗
              </a>
            ) : (
              <Link href={l.href} className="text-muted hover:text-accent">
                {l.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

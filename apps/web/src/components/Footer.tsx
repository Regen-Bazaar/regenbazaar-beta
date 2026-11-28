import Link from "next/link";
import { Icon, type IconName } from "./ui/Icon";

const LEARN: { href: string; label: string; icon: IconName }[] = [
  { href: "/guide", label: "Guide", icon: "book" },
  { href: "/methodology", label: "Scoring", icon: "ruler" },
  { href: "/roadmap", label: "Roadmap", icon: "calendar" },
  { href: "/dashboard", label: "Dashboard", icon: "list" },
];
const ELSEWHERE: { href: string; label: string; icon: IconName }[] = [
  { href: "https://www.regenbazaar.com", label: "regenbazaar.com", icon: "globe" },
  { href: "https://x.com/RegenBazaar", label: "X", icon: "link" },
  { href: "https://t.me/regen_bazaar", label: "Telegram", icon: "share" },
  { href: "https://github.com/Regen-Bazaar/regenbazaar-beta", label: "GitHub", icon: "doc" },
];

const LINK = "inline-flex min-h-11 items-center gap-1.5 text-meta text-muted hover:text-fg";

/** Compact footer: one line on desktop, three on a phone (link icons are dropped there to keep each group on one line). The four main destinations are in the app bar and the tab bar, not here. */
export function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="page-wrap flex flex-col py-2 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
        <p className="order-last flex items-center gap-1.5 py-2 text-label text-subtle lg:order-first">
          <Icon name="drop" />
          Test version, no real money
        </p>
        <div className="flex flex-col lg:flex-row lg:gap-8">
          <nav aria-label="Learn" className="flex flex-wrap gap-x-4">
            {LEARN.map((l) => (
              <Link key={l.href} href={l.href} className={LINK}>
                <Icon name={l.icon} className="max-sm:hidden" />
                {l.label}
              </Link>
            ))}
          </nav>
          <nav aria-label="Elsewhere" className="flex flex-wrap gap-x-4">
            {ELSEWHERE.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className={LINK}>
                <Icon name={l.icon} className="max-sm:hidden" />
                {l.label}
              </a>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}

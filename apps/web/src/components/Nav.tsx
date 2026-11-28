"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "./ConnectButton";
import { Logo } from "./Logo";
import { NetworkSwitcher } from "./NetworkSwitcher";
import { Icon, type IconName } from "./ui/Icon";

// The four destinations, the same on the desktop app bar and the phone tab bar.
// Guide, scoring, roadmap and the dashboard are in the footer; the dashboard is also in the wallet menu.
// Verify is for validators and deliberately not in the menu; they open /verify directly.
const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/marketplace", label: "Marketplace", icon: "store" },
  { href: "/tokenize", label: "Tokenize", icon: "plus" },
  { href: "/portfolio", label: "My impact", icon: "grid" },
  { href: "/leaderboard", label: "Ranks", icon: "trophy" },
];

function useOn() {
  const path = usePathname();
  return (href: string) => path === href || path.startsWith(`${href}/`);
}

/** App bar. On a phone it scrolls away with the page (the tab bar stays); on desktop it sticks to the top. */
export function Nav() {
  const on = useOn();
  return (
    <header className="border-b border-line bg-bg lg:sticky lg:top-0 lg:z-40">
      <div className="page-wrap flex h-14 items-center gap-2.5 whitespace-nowrap lg:h-[68px] lg:gap-7">
        <Link href="/" className="flex min-h-11 flex-none items-center gap-4" aria-label="Regen Bazaar home">
          <Logo className="h-[22px] w-auto flex-none text-fg" />
          <span className="hidden font-display text-[22px] lg:inline">Regen Bazaar</span>
        </Link>

        <nav className="hidden items-center gap-7 text-[17px] lg:flex" aria-label="Main">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on(t.href) ? "page" : undefined}
              className={`inline-flex min-h-11 items-center gap-2 border-b-2 transition-colors ${on(t.href) ? "border-primary text-fg" : "border-transparent text-muted hover:text-fg"}`}
            >
              <Icon name={t.icon} />
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex min-w-0 items-center gap-2.5 lg:gap-4">
          <NetworkSwitcher />
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}

/** Phone tab bar, fixed to the bottom of the screen. Hidden on desktop, where the app bar carries the same links. */
export function TabBar() {
  const on = useOn();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={on(t.href) ? "page" : undefined}
          className={`flex h-14 flex-col items-center justify-center gap-0.5 text-label ${on(t.href) ? "font-semibold text-fg" : "text-subtle"}`}
        >
          <Icon name={t.icon} className={on(t.href) ? "text-primary" : ""} />
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { ConnectButton } from "./ConnectButton";
import { Logo } from "./Logo";
import { NetworkSwitcher } from "./NetworkSwitcher";
import { ThemeToggle } from "./ThemeToggle";

// Verify is reviewer-only (password) and deliberately not in the menu; reviewers use /verify directly.
const MAIN = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/tokenize", label: "Tokenize impact" },
  { href: "/portfolio", label: "My impact" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/guide", label: "Guide" },
];
const MORE = [
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/methodology", label: "Methodology" },
  { href: "/roadmap", label: "Roadmap" },
];

export function Nav() {
  const path = usePathname();
  const moreRef = useRef<HTMLDetailsElement>(null);
  const mobileRef = useRef<HTMLDetailsElement>(null);
  // Close open menus after navigating.
  useEffect(() => {
    moreRef.current?.removeAttribute("open");
    mobileRef.current?.removeAttribute("open");
  }, [path]);

  const on = (href: string) => path === href || path.startsWith(`${href}/`);
  const moreOn = MORE.some((l) => on(l.href));

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur-md">
      <div className="page-wrap flex h-[72px] items-center gap-6 whitespace-nowrap">
        <Link href="/" className="flex items-center gap-3" aria-label="Regen Bazaar home">
          <Logo className="h-6 w-auto text-fg" />
          <span className="hidden font-display text-[22px] sm:inline">
            Regen <span className="text-accent">Bazaar</span>
          </span>
        </Link>

        <nav className="ml-2 hidden items-center gap-6 text-[17px] xl:flex" aria-label="Main">
          {MAIN.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`border-b-2 py-1.5 transition-colors ${on(l.href) ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}
            >
              {l.label}
            </Link>
          ))}
          <details ref={moreRef} className="relative">
            <summary
              className={`cursor-pointer list-none border-b-2 py-1.5 transition-colors ${moreOn ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"}`}
            >
              More ▾
            </summary>
            <div className="card absolute left-0 z-50 mt-3 flex w-52 flex-col p-2 shadow-xl">
              {MORE.map((l) => (
                <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-2 hover:bg-raised ${on(l.href) ? "text-accent" : "text-fg"}`}>
                  {l.label}
                </Link>
              ))}
            </div>
          </details>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden md:block">
            <NetworkSwitcher />
          </div>
          <ThemeToggle />
          <ConnectButton />

          {/* compact screens (no-JS disclosure) */}
          <details ref={mobileRef} className="relative xl:hidden">
            <summary
              aria-label="Menu"
              className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full border border-line-strong bg-surface text-fg"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-[18px] w-[18px]" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </summary>
            <nav className="card absolute right-0 z-50 mt-3 flex w-64 flex-col gap-0.5 p-2 text-base shadow-xl" aria-label="Menu">
              {[...MAIN, ...MORE].map((l) => (
                <Link key={l.href} href={l.href} className={`rounded-lg px-3 py-2 hover:bg-raised ${on(l.href) ? "text-accent" : "text-fg"}`}>
                  {l.label}
                </Link>
              ))}
              <div className="mt-1 border-t border-line md:hidden">
                <NetworkSwitcher compact />
              </div>
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}

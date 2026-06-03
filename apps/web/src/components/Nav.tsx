import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-gold/20 bg-ink-soft/40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Regen <span className="text-gold">Bazaar</span>
        </Link>
        <nav className="flex gap-7 text-sm">
          <Link href="/dashboard" className="text-paper/75 transition-colors hover:text-gold">
            Dashboard
          </Link>
          <Link href="/tokenize" className="text-paper/75 transition-colors hover:text-gold">
            Tokenize impact
          </Link>
          <Link href="/marketplace" className="text-paper/75 transition-colors hover:text-gold">
            Marketplace
          </Link>
        </nav>
      </div>
    </header>
  );
}

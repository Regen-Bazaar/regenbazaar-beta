import Link from "next/link";

const CYCLE = [
  { k: "Work", d: "NGOs capture real-world impact — assessment, actions, report." },
  { k: "Tokenize", d: "Verified impact is minted as fractional tRWI on-chain." },
  { k: "Evaluate", d: "An AI engine scores Impact Value; validators attest." },
  { k: "Fund", d: "Buyers and investors fund it, earn $REBAZ, retire impact." },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <p className="mb-4 text-xs uppercase tracking-[0.2em] text-gold">Beta · Celo Sepolia</p>
      <h1 className="max-w-3xl text-5xl font-bold leading-[1.1]">
        We turn verified real-world impact into a <span className="text-gold">tradable asset class</span>.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-paper/80">
        For NGOs and communities to tokenize their impact — across environment, animal welfare, education,
        poverty and beyond — and for buyers and investors to fund it.
      </p>
      <div className="mt-8 flex flex-wrap gap-4">
        <Link href="/tokenize" className="rounded-md bg-gold px-5 py-3 font-semibold text-ink transition-colors hover:bg-gold-soft">
          Tokenize impact
        </Link>
        <Link href="/dashboard" className="rounded-md border border-gold/40 px-5 py-3 transition-colors hover:border-gold">
          NGO dashboard
        </Link>
      </div>

      <div className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CYCLE.map((c, i) => (
          <div key={c.k} className="rounded-lg border border-gold/15 bg-ink-soft/40 p-5">
            <div className="mb-2 text-sm text-gold">
              {String(i + 1).padStart(2, "0")} · {c.k}
            </div>
            <p className="text-sm text-paper/75">{c.d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}

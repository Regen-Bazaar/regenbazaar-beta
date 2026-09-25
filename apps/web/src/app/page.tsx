import Link from "next/link";
import { currentNetwork } from "../lib/network-server";
import { enabledNetworks } from "../lib/networks";

const CYCLE = [
  { k: "Report", d: "An NGO describes its work in plain language: what, how many, where, when." },
  { k: "Evaluate", d: "AI extracts the actions, a published formula scores Impact Value, a validator attests it on-chain." },
  { k: "List", d: "The attested impact is listed as tRWI editions. Nothing is minted until someone funds it." },
  { k: "Fund", d: "A funder pays in a USDG stablecoin: tRWI is minted to them and the NGO is paid in the same transaction." },
];

export default async function Home() {
  const NETWORK = await currentNetwork();
  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <p className="mb-4 text-xs uppercase tracking-[0.2em] text-gold">Beta · {NETWORK.chain.name} (testnet)</p>
      <h1 className="max-w-3xl text-5xl font-bold leading-[1.1]">
        We turn verified real-world impact into a <span className="text-gold">tradable asset class</span>.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-paper/80">
        For NGOs and communities to tokenize their impact — across environment, animal welfare, education,
        poverty and beyond — and for funders to back it with stablecoins, with proof on-chain.
      </p>
      <div className="mt-8 flex flex-wrap gap-4">
        <Link href="/marketplace" className="rounded-md bg-gold px-5 py-3 font-semibold text-ink transition-colors hover:bg-gold-soft">
          Fund impact
        </Link>
        <Link href="/tokenize" className="rounded-md border border-gold/40 px-5 py-3 transition-colors hover:border-gold">
          Tokenize impact (NGOs)
        </Link>
        <Link href="/guide" className="px-2 py-3 text-paper/75 underline transition-colors hover:text-gold">
          How to try the demo →
        </Link>
        <Link href="/roadmap" className="px-2 py-3 text-paper/75 underline transition-colors hover:text-gold">
          Roadmap →
        </Link>
      </div>

      <section className="mt-14">
        <h2 className="text-sm uppercase tracking-[0.2em] text-gold">Choose your network</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {enabledNetworks().map((n) => {
            const active = n.key === NETWORK.key;
            return (
              <a
                key={n.key}
                href={`/marketplace?network=${n.key}`}
                className={`rounded-xl border p-5 transition-colors ${active ? "border-gold bg-ink-soft/60" : "border-gold/20 bg-ink-soft/30 hover:border-gold/60"}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">{n.chain.name}</span>
                  {active && <span className="rounded-full bg-gold/20 px-2 py-0.5 text-xs text-gold">selected</span>}
                </div>
                <p className="mt-2 text-sm text-paper/70">
                  {n.saleCurrency.testMint
                    ? `Easiest start: pay in ${n.saleCurrency.symbol}, free test tokens in one click.`
                    : `Pay in ${n.saleCurrency.symbol}, the Paxos stablecoin (test version from the Paxos faucet).`}
                </p>
                <span className="mt-3 inline-block text-sm text-gold">Open marketplace →</span>
              </a>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-paper/50">
          Same contracts on both Arbitrum chains. You can switch any time from the header.
        </p>
      </section>

      <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

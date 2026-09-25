import Link from "next/link";
import { and, countDistinct, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { impactSubmissions, listings } from "@rb/db/schema";
import { getDb } from "../lib/db";
import { currentNetwork } from "../lib/network-server";
import { DEFAULT_NETWORK_KEY, NATIVE, enabledNetworks } from "../lib/networks";

export const dynamic = "force-dynamic";

const CYCLE = [
  { k: "Report", d: "An NGO describes its work in plain language: what, how many, where, when." },
  { k: "Evaluate", d: "AI extracts the actions, a published formula scores Impact Value, a validator attests it on-chain." },
  { k: "List", d: "The attested impact is listed as tRWI editions. Nothing is minted until someone funds it." },
  { k: "Fund", d: "A funder pays in the network's currency (USDG stablecoin, or CELO on Celo): tRWI is minted to them and the NGO is paid in the same transaction." },
];

export default async function Home() {
  const NETWORK = await currentNetwork();
  // Three listed reports on this network for the hero artwork (one report, one network).
  const db = await getDb();
  const featured = await db
    .select({ id: impactSubmissions.id, title: impactSubmissions.title })
    .from(listings)
    .innerJoin(impactSubmissions, eq(listings.submissionId, impactSubmissions.id))
    .where(and(eq(listings.active, true), eq(listings.chainId, NETWORK.chain.id)))
    .orderBy(desc(impactSubmissions.ivValue))
    .limit(3);
  // Nothing listed yet on this network: fall back to verified reports submitted on it (artwork only).
  const onThisNetwork =
    NETWORK.key === DEFAULT_NETWORK_KEY
      ? or(eq(impactSubmissions.chainId, NETWORK.chain.id), isNull(impactSubmissions.chainId))
      : eq(impactSubmissions.chainId, NETWORK.chain.id);
  const cards =
    featured.length > 0
      ? featured
      : await db
          .select({ id: impactSubmissions.id, title: impactSubmissions.title })
          .from(impactSubmissions)
          .where(and(inArray(impactSubmissions.status, ["verified", "tokenized"]), onThisNetwork))
          .orderBy(desc(impactSubmissions.ivValue))
          .limit(3);

  // Live counts from the database (approved reports on the test networks), shown as they are: no rounding up.
  const [stats] = await db
    .select({
      reports: sql<number>`count(*)::int`,
      totalIv: sql<string>`coalesce(sum(${impactSubmissions.ivValue}), 0)`,
      orgs: countDistinct(impactSubmissions.orgId),
    })
    .from(impactSubmissions)
    .where(inArray(impactSubmissions.status, ["verified", "tokenized"]));
  // Distinct reports, not listing rows: a few early test reports were listed on two networks before the
  // one-report-one-network rule, and counting rows would show more listings than reports.
  const [listed] = await db.select({ n: countDistinct(listings.submissionId) }).from(listings).where(eq(listings.active, true));
  const STATS = [
    { v: Number(stats?.reports ?? 0).toLocaleString("en-US"), k: "verified impact reports" },
    { v: Number(stats?.totalIv ?? 0).toLocaleString("en-US", { maximumFractionDigits: 0 }), k: "total Impact Value" },
    { v: Number(stats?.orgs ?? 0).toLocaleString("en-US"), k: "organisations" },
    { v: Number(listed?.n ?? 0).toLocaleString("en-US"), k: "reports listed on-chain" },
    { v: String(enabledNetworks().length), k: "test networks" },
  ];

  return (
    <main>
      <section className="hero-bg border-b border-line">
        <div className="page-wrap grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:py-24">
          <div>
            <p className="label-mono flex items-center gap-3 !text-accent">
              <span className="inline-block h-px w-7 bg-current" aria-hidden="true" />
              Beta · {NETWORK.chain.name} (testnet)
            </p>
            <h1 className="mt-5 text-[clamp(2.6rem,5.4vw,5.25rem)]">
              We turn verified real-world impact into a <span className="text-accent">tradable asset class</span>.
            </h1>
            <p className="mt-6 max-w-[40ch] text-[clamp(1.1875rem,1.5vw,1.375rem)] text-muted">
              For NGOs and communities to tokenize their impact, across environment, animal welfare, education,
              poverty and beyond; for funders to back it with stablecoins, with proof on-chain.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link href="/marketplace" className="btn btn-primary">
                Fund impact
              </Link>
              <Link href="/tokenize" className="btn btn-secondary">
                Tokenize impact (NGOs)
              </Link>
              <Link href="/guide" className="link px-2 py-3">
                How to try the demo →
              </Link>
            </div>
          </div>

          {cards.length > 0 && (
            <figure className="relative mx-auto h-[280px] w-full max-w-[560px] sm:h-[400px] lg:h-[540px] lg:max-w-none">
              {cards.map((f, i) => (
                <Link
                  key={f.id}
                  href={`/submission/${f.id}`}
                  className={`absolute w-[58%] transition-transform hover:z-20 hover:-translate-y-2 ${
                    cards.length === 1
                      ? "left-[21%] top-0"
                      : ["left-[22%] top-0 z-10 rotate-1", "left-0 top-[13%] -rotate-6", "right-0 top-[20%] rotate-[7deg]"][i]
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- our own generated SVG */}
                  <img src={`/api/submissions/${f.id}/image`} alt={`tRWI card: ${f.title}`} className="art aspect-square w-full" />
                </Link>
              ))}
              <figcaption className="absolute inset-x-0 bottom-0 hidden text-center text-sm text-subtle lg:block">
                Every verified report becomes a tRWI card, generated from its data.
              </figcaption>
            </figure>
          )}
        </div>
      </section>

      <section aria-label="Beta in numbers" className="border-b border-line bg-surface">
        <div className="page-wrap py-8">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
            {STATS.map((x) => (
              <div key={x.k}>
                <dt className="sr-only">{x.k}</dt>
                <dd className="font-display text-4xl leading-none md:text-5xl">{x.v}</dd>
                <dd className="mt-2 text-muted">{x.k}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm text-subtle">Live from the beta database. Test networks and sample reports, no real money.</p>
        </div>
      </section>

      <div className="page-wrap pb-8">
        <section className="mt-16 md:mt-20">
          <h2 className="label-mono !text-accent">Choose your network</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {enabledNetworks().map((n) => {
              const active = n.key === NETWORK.key;
              return (
                <a
                  key={n.key}
                  href={`/marketplace?network=${n.key}`}
                  className={`card flex flex-col p-6 transition-colors ${active ? "!border-accent" : "hover:!border-line-strong"}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-display text-2xl">{n.chain.name}</span>
                    {active && <span className="badge badge-gold">selected</span>}
                  </div>
                  <p className="mt-3 text-muted">
                    {n.saleCurrency.address === NATIVE
                      ? `Pay in ${n.saleCurrency.symbol}, the network's own coin: one test token covers fees and purchase.`
                      : n.saleCurrency.testMint
                      ? `Easiest start: pay in ${n.saleCurrency.symbol}, free test tokens in one click.`
                      : `Pay in ${n.saleCurrency.symbol}, the Paxos stablecoin (test version from the Paxos faucet).`}
                  </p>
                  <span className="link mt-auto pt-4">Open marketplace →</span>
                </a>
              );
            })}
          </div>
          <p className="mt-4 text-sm text-subtle">
            Same contracts on every network. Each impact report is listed on one network only, so nothing is counted twice.
            You can switch any time from the header.
          </p>
        </section>

        <section className="mt-20">
          <h2 className="label-mono !text-accent">How it works</h2>
          <ol className="relative mt-8 grid gap-10 lg:grid-cols-4 lg:gap-8">
            {/* connecting line behind the step markers */}
            <span aria-hidden="true" className="absolute left-[27px] top-2 bottom-2 w-px bg-line-strong lg:left-7 lg:right-7 lg:top-[27px] lg:bottom-auto lg:h-px lg:w-auto" />
            {CYCLE.map((c, i) => (
              <li key={c.k} className="relative flex gap-5 lg:block">
                <div className="relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-full border border-accent bg-bg font-display text-2xl text-accent">
                  {i + 1}
                </div>
                <div>
                  <h3 className="text-2xl lg:mt-5">{c.k}</h3>
                  <p className="mt-2 max-w-[34ch] text-muted">{c.d}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-10">
            <Link href="/methodology" className="link">How Impact Value is calculated →</Link>
            <span className="mx-3 text-subtle">·</span>
            <Link href="/roadmap" className="link">Roadmap →</Link>
          </p>
        </section>
      </div>
    </main>
  );
}

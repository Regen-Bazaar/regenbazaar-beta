import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { impactSubmissions, listings, organizations } from "@rb/db/schema";
import { getDb } from "../../lib/db";
import { BuyButton } from "../../components/BuyButton";
import { currentNetwork } from "../../lib/network-server";
import { DEFAULT_NETWORK_KEY, getNetwork } from "../../lib/networks";
import { formatUnits } from "viem";

export const dynamic = "force-dynamic";

type Tags = { sdg: string[]; ebf: string[] } | null;
type Search = { domain?: string; sdg?: string; ebf?: string; q?: string };

function hrefWith(current: Search, patch: Partial<Search>): string {
  const merged = { ...current, ...patch };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
  const qs = params.toString();
  return qs ? `/marketplace?${qs}` : "/marketplace";
}

export default async function Marketplace({ searchParams }: { searchParams: Promise<Search> }) {
  const NETWORK = await currentNetwork();
  const sp = await searchParams;
  const db = await getDb();
  const submitted = (
    await db
      .select({ s: impactSubmissions, orgName: organizations.name })
      .from(impactSubmissions)
      .innerJoin(organizations, eq(impactSubmissions.orgId, organizations.id))
      .where(inArray(impactSubmissions.status, ["verified", "tokenized"]))
      .orderBy(desc(impactSubmissions.ivValue))
      .limit(120)
  ).map((r) => ({ ...r.s, orgName: r.orgName }));

  // Active primary listings (v2): submissionId -> listingId. A listed item is buyable via voucher redeem.
  const listingRows = await db
    .select({
      submissionId: listings.submissionId,
      id: listings.id,
      pricePerEdition: listings.pricePerEdition,
      maxEditions: listings.maxEditions,
    })
    .from(listings)
    .where(and(eq(listings.active, true), eq(listings.chainId, NETWORK.chain.id)));
  const listingBySubmission = new Map(listingRows.map((r) => [r.submissionId, r]));

  // One report, one network: show a report only on the network it is listed on, or (not listed yet) the one
  // it was submitted on. Legacy rows without a network belong to the default network.
  const listedAnywhere = new Set(
    (await db.select({ submissionId: listings.submissionId }).from(listings)).map((r) => r.submissionId),
  );
  const defaultChainId = getNetwork(DEFAULT_NETWORK_KEY).chain.id;
  const all = submitted.filter(
    (r) =>
      listingBySubmission.has(r.id) ||
      (!listedAnywhere.has(r.id) && (r.chainId ?? defaultChainId) === NETWORK.chain.id),
  );

  // Filter facets derived from the full set (so chips reflect what's actually available).
  const domains = [...new Set(all.map((r) => r.domain).filter(Boolean) as string[])].sort();
  const sdgs = [...new Set(all.flatMap((r) => (r.frameworkTags as Tags)?.sdg ?? []))].sort();
  const ebfs = [...new Set(all.flatMap((r) => (r.frameworkTags as Tags)?.ebf ?? []))].sort();

  const q = (sp.q ?? "").toLowerCase().trim();
  const rows = all.filter((r) => {
    const tags = r.frameworkTags as Tags;
    if (sp.domain && r.domain !== sp.domain) return false;
    if (sp.sdg && !(tags?.sdg ?? []).includes(sp.sdg)) return false;
    if (sp.ebf && !(tags?.ebf ?? []).includes(sp.ebf)) return false;
    if (q && !r.title.toLowerCase().includes(q)) return false;
    return true;
  });

  const active = sp.domain || sp.sdg || sp.ebf || sp.q;

  const Chip = ({ label, on, href }: { label: string; on: boolean; href: string }) => (
    <Link
      href={href}
      className={`rounded-full px-2.5 py-1 text-xs transition-colors ${
        on ? "bg-gold text-ink" : "border border-gold/25 text-paper/70 hover:border-gold hover:text-gold"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold">Marketplace</h1>
      <p className="mt-2 text-paper/70">
        Fund verified real-world impact. Each edition is a fractional share of the claim. Paid in{" "}
        {NETWORK.saleCurrency.symbol} on {NETWORK.chain.name}.{" "}
        <Link href="/guide" className="text-gold underline">
          New here? How to fund →
        </Link>
      </p>

      {/* filter bar */}
      <div className="mt-6 space-y-3 rounded-xl border border-gold/15 bg-ink-soft/30 p-4">
        <form method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={sp.q ?? ""}
            placeholder="Search title…"
            aria-label="Search impact by title"
            className="flex-1 rounded-md border border-gold/20 bg-ink-soft px-3 py-2 text-sm outline-none focus:border-gold"
          />
          {sp.domain && <input type="hidden" name="domain" value={sp.domain} />}
          {sp.sdg && <input type="hidden" name="sdg" value={sp.sdg} />}
          {sp.ebf && <input type="hidden" name="ebf" value={sp.ebf} />}
          <button className="rounded-md border border-gold/40 px-4 text-sm hover:border-gold hover:text-gold">
            Search
          </button>
        </form>
        {domains.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs uppercase tracking-wide text-paper/45">Domain</span>
            {domains.map((d) => (
              <Chip key={d} label={d.replace(/_/g, " ")} on={sp.domain === d} href={hrefWith(sp, { domain: sp.domain === d ? "" : d })} />
            ))}
          </div>
        )}
        {sdgs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs uppercase tracking-wide text-paper/45">SDG</span>
            {sdgs.map((t) => (
              <Chip key={t} label={t} on={sp.sdg === t} href={hrefWith(sp, { sdg: sp.sdg === t ? "" : t })} />
            ))}
          </div>
        )}
        {ebfs.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs uppercase tracking-wide text-paper/45">EBF</span>
            {ebfs.map((t) => (
              <Chip key={t} label={t} on={sp.ebf === t} href={hrefWith(sp, { ebf: sp.ebf === t ? "" : t })} />
            ))}
          </div>
        )}
        {active && (
          <Link href="/marketplace" className="inline-block text-xs text-gold underline">
            Clear filters
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-gold/15 bg-ink-soft/40 p-10 text-center text-paper/60">
          {active ? (
            <>No impact matches these filters. <Link href="/marketplace" className="text-gold underline">Clear</Link>.</>
          ) : (
            <>No verified impact yet. Approve submissions in the{" "}
              <Link href="/verify" className="text-gold underline">verification queue</Link>.</>
          )}
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((l) => {
            const tags = l.frameworkTags as Tags;
            const listing = listingBySubmission.get(l.id);
            const tokenized = !!listing; // listed (EAS-attested) on THIS network
            return (
              <div key={l.id} className="flex flex-col rounded-xl border border-gold/15 bg-ink-soft/40 p-5">
                <Link href={`/submission/${l.id}`} className="mb-3 block overflow-hidden rounded-lg border border-gold/10">
                  {/* eslint-disable-next-line @next/next/no-img-element -- our own generated SVG */}
                  <img src={`/api/submissions/${l.id}/image`} alt={`tRWI card: ${l.title}`} className="aspect-square w-full" loading="lazy" />
                </Link>
                <Link href={`/submission/${l.id}`} className="font-medium leading-snug hover:text-gold">
                  {l.title}
                </Link>
                <div className="mt-0.5 text-xs text-paper/50">by {l.orgName}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags?.sdg.slice(0, 3).map((t) => (
                    <span key={t} className="rounded-full bg-green/25 px-2 py-0.5 text-xs text-paper/80">{t}</span>
                  ))}
                  {tags?.ebf.slice(0, 2).map((t) => (
                    <span key={t} className="rounded-full border border-gold/40 px-2 py-0.5 text-xs text-gold">EBF {t}</span>
                  ))}
                </div>
                <div className="mt-auto flex items-end justify-between pt-4">
                  <div>
                    <div className="text-xs text-paper/45">Impact Value</div>
                    <div className="font-semibold text-gold">{Number(l.ivValue ?? 0).toLocaleString()}</div>
                  </div>
                  {listing && (
                    <div>
                      <div className="text-xs text-paper/45">Price per edition</div>
                      <div className="font-semibold">
                        {Number(formatUnits(BigInt(listing.pricePerEdition), NETWORK.saleCurrency.decimals)).toLocaleString("en-US", { maximumFractionDigits: 6 })}{" "}
                        {NETWORK.saleCurrency.symbol}
                      </div>
                    </div>
                  )}
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs ${tokenized ? "bg-green-soft/50 text-paper" : "bg-gold/20 text-gold"}`}
                  >
                    {tokenized ? "on-chain" : "verified"}
                  </span>
                </div>
                {listing ? (
                  <BuyButton listingId={listing.id} />
                ) : (
                  <button
                    disabled
                    className="mt-4 rounded-md border border-gold/40 py-2 text-sm opacity-50"
                  >
                    {l.status === "tokenized" ? `Not yet listed on ${NETWORK.chain.name}` : "Awaiting verification"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

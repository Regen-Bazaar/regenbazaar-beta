import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { impactSubmissions, listings, organizations, partners } from "@rb/db/schema";
import { getDb } from "../../lib/db";
import { BuyButton } from "../../components/BuyButton";
import { SaleSplit } from "../../components/SaleSplit";
import { TestTokens } from "../../components/TestTokens";
import { currentNetwork } from "../../lib/network-server";
import { DEFAULT_NETWORK_KEY, getNetwork } from "../../lib/networks";
import { formatUnits } from "viem";
import { FrameworkTag } from "../../components/FrameworkTag";
import { ProofBadge, VersionBadge } from "../../components/ImpactBadges";
import { headline, impactView } from "../../lib/impact-view";

export const metadata = {
  title: "Marketplace",
  description: "Fund verified real-world impact. Each tRWI edition is a fractional share of an attested impact claim.",
};

export const dynamic = "force-dynamic";

type Tags = { sdg: string[]; ebf: string[] } | null;
type Search = { domain?: string; sdg?: string; ebf?: string; q?: string; proof?: string; sort?: string };
const PROOF_FILTERS = ["P1", "P2", "P3", "P4"];
const SORTS = [
  ["", "Impact Value"],
  ["score", "Domain score"],
  ["price", "Price per edition"],
  ["value", "IV per $100"],
] as const;

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
      priceUsd: listings.priceUsd,
      partnerName: partners.name,
      partnerFeeBps: partners.feeBps,
    })
    .from(listings)
    .leftJoin(partners, eq(listings.partnerId, partners.id))
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
    // Proof filter: this level or higher (v0.1 reports have no proof level).
    if (sp.proof && PROOF_FILTERS.includes(sp.proof)) {
      const level = impactView(r).proofLevel;
      if (!level || level < sp.proof) return false;
    }
    return true;
  });
  const ivPer100 = (r: (typeof rows)[number]) => {
    const usd = Number(listingBySubmission.get(r.id)?.priceUsd ?? 0);
    return usd > 0 ? (Number(r.ivValue ?? 0) / usd) * 100 : -1;
  };
  if (sp.sort === "value") {
    rows.sort((a, b) => ivPer100(b) - ivPer100(a));
  } else if (sp.sort === "score") {
    rows.sort((a, b) => (impactView(b).primary?.score ?? 0) - (impactView(a).primary?.score ?? 0));
  } else if (sp.sort === "price") {
    const price = (id: string) => {
      const l = listingBySubmission.get(id);
      return l ? BigInt(l.pricePerEdition) : -1n;
    };
    rows.sort((a, b) => {
      const pa = price(a.id);
      const pb = price(b.id);
      if (pa < 0n || pb < 0n) return pa < 0n ? (pb < 0n ? 0 : 1) : -1;
      return pa < pb ? -1 : pa > pb ? 1 : 0;
    });
  }

  const active = sp.domain || sp.sdg || sp.ebf || sp.q || sp.proof;

  const Chip = ({ label, on, href }: { label: string; on: boolean; href: string }) => (
    <Link
      href={href}
      aria-current={on ? "true" : undefined}
      className={`rounded-full border px-3 py-1 text-sm transition-colors ${
        on ? "border-fg bg-fg text-bg" : "border-line-strong text-muted hover:border-accent hover:text-accent"
      }`}
    >
      {label}
    </Link>
  );

  const filterGroups = (
    <>
            {domains.length > 0 && (
              <div className="mt-6">
                <h2 className="label-mono mb-2.5">Domain</h2>
                <div className="flex flex-wrap gap-2">
                  {domains.map((d) => (
                    <Chip key={d} label={d.replace(/_/g, " ")} on={sp.domain === d} href={hrefWith(sp, { domain: sp.domain === d ? "" : d })} />
                  ))}
                </div>
              </div>
            )}
            <div className="mt-6">
              <h2 className="label-mono mb-2.5">Proof level</h2>
              <div className="flex flex-wrap gap-2">
                {PROOF_FILTERS.map((p) => (
                  <Chip key={p} label={`${p}+`} on={sp.proof === p} href={hrefWith(sp, { proof: sp.proof === p ? "" : p })} />
                ))}
              </div>
            </div>
            <div className="mt-6">
              <h2 className="label-mono mb-2.5">Sort by</h2>
              <div className="flex flex-wrap gap-2">
                {SORTS.map(([v, label]) => (
                  <Chip key={v || "iv"} label={label} on={(sp.sort ?? "") === v} href={hrefWith(sp, { sort: v })} />
                ))}
              </div>
            </div>
            {sdgs.length > 0 && (
              <div className="mt-6">
                <h2 className="label-mono mb-2.5">SDG</h2>
                <div className="flex flex-wrap gap-2">
                  {sdgs.map((t) => (
                    <Chip key={t} label={t} on={sp.sdg === t} href={hrefWith(sp, { sdg: sp.sdg === t ? "" : t })} />
                  ))}
                </div>
              </div>
            )}
            {ebfs.length > 0 && (
              <div className="mt-6">
                <h2 className="label-mono mb-2.5">EBF</h2>
                <div className="flex flex-wrap gap-2">
                  {ebfs.map((t) => (
                    <Chip key={t} label={t} on={sp.ebf === t} href={hrefWith(sp, { ebf: sp.ebf === t ? "" : t })} />
                  ))}
                </div>
              </div>
            )}
    </>
  );
  const activeFilters = [sp.domain, sp.sdg, sp.ebf, sp.proof].filter(Boolean).length;

  return (
    <main className="page-wrap py-10 md:py-14">
      <h1 className="text-[clamp(2.5rem,4vw,3.5rem)]">Marketplace</h1>
      <p className="mt-3 max-w-[70ch] text-lg text-muted">
        Fund verified real-world impact. Each edition is a fractional share of the claim. Paid in{" "}
        {NETWORK.saleCurrency.symbol} on {NETWORK.chain.name}.{" "}
        <Link href="/guide" className="link">
          New here? How to fund →
        </Link>
      </p>

      <div className="mt-10 grid grid-cols-[minmax(0,1fr)] items-start gap-10 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)]">
        {/* filter rail */}
        <aside className="lg:sticky lg:top-24" aria-label="Filters">
          <form method="get" className="flex gap-2">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search title…"
              aria-label="Search impact by title"
              className="field min-w-0 flex-1"
            />
            {sp.domain && <input type="hidden" name="domain" value={sp.domain} />}
            {sp.sdg && <input type="hidden" name="sdg" value={sp.sdg} />}
            {sp.ebf && <input type="hidden" name="ebf" value={sp.ebf} />}
            {sp.proof && <input type="hidden" name="proof" value={sp.proof} />}
            {sp.sort && <input type="hidden" name="sort" value={sp.sort} />}
            <button className="btn btn-secondary btn-sm">Search</button>
          </form>
          <div className="hidden lg:block">{filterGroups}</div>
          <details className="mt-3 lg:hidden" open={activeFilters > 0}>
            <summary className="btn btn-secondary btn-sm w-full cursor-pointer list-none">
              Filters{activeFilters > 0 ? ` (${activeFilters} on)` : ""} ▾
            </summary>
            <div className="pt-2">{filterGroups}</div>
          </details>
        </aside>

        <section aria-label="Results">
          {rows.some((r) => listingBySubmission.has(r.id)) && (
            <div className="mb-6">
              <TestTokens />
            </div>
          )}
          <div className="mb-5 flex items-baseline justify-between gap-4 text-muted">
            <span>
              {rows.length} {rows.length === 1 ? "report" : "reports"}
            </span>
            {active && (
              <Link href="/marketplace" className="link">
                Clear filters
              </Link>
            )}
          </div>

      {rows.length === 0 ? (
        <div className="card p-10 text-center text-muted">
          {active ? (
            <>No impact matches these filters. <Link href="/marketplace" className="link">Clear</Link>.</>
          ) : (
            <>No verified impact yet. Approve submissions in the{" "}
              <Link href="/verify" className="link">verification queue</Link>.</>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,290px),1fr))] gap-6">
          {rows.map((l) => {
            const tags = l.frameworkTags as Tags;
            const listing = listingBySubmission.get(l.id);
            const tokenized = !!listing; // listed (EAS-attested) on THIS network
            const view = impactView(l);
            const h = headline(view);
            return (
              <article key={l.id} className="card flex flex-col overflow-hidden transition-colors hover:!border-line-strong">
                <Link href={`/submission/${l.id}`} className="relative block">
                  {/* eslint-disable-next-line @next/next/no-img-element -- our own generated SVG */}
                  <img src={`/api/submissions/${l.id}/image`} alt={`tRWI card: ${l.title}`} className="block aspect-square w-full" loading="lazy" />
                  <span className={`badge absolute right-3 top-3 !bg-ink ${tokenized ? "badge-ok !text-[#8fbf7f]" : "badge-gold !text-gold"}`}>
                    {tokenized ? "on-chain" : "verified"}
                  </span>
                </Link>
                <div className="flex flex-1 flex-col p-5">
                  <Link href={`/submission/${l.id}`} className="line-clamp-2 text-[1.25rem] font-semibold leading-snug hover:text-accent">
                    {l.title}
                  </Link>
                  <div className="mt-1 truncate text-sm text-muted">by {l.orgName}</div>
                  <div className="mb-5 mt-3 flex flex-wrap gap-1.5">
                    {view.version === "v0.2" && <ProofBadge level={view.proofLevel} />}
                    <VersionBadge version={view.version} />
                    {tags?.sdg.slice(0, 3).map((t) => (
                      <FrameworkTag key={t} kind="sdg" value={t} />
                    ))}
                    {tags?.ebf.slice(0, 1).map((t) => (
                      <FrameworkTag key={t} kind="ebf" value={t} />
                    ))}
                  </div>
                  <div className="mt-auto grid grid-cols-2 gap-3 border-t border-line pt-4">
                    <div className="min-w-0">
                      <div className="label-mono truncate">{h.label}</div>
                      <div className="text-xl font-semibold text-accent">{h.value}</div>
                      {view.version === "v0.2" && h.sub && <div className="truncate text-xs text-subtle">{h.sub}</div>}
                    </div>
                    <div>
                      <div className="label-mono">Per edition</div>
                      <div className="text-xl font-semibold">
                        {listing ? (
                          <>
                            {listing.priceUsd != null && <span>${(Number(listing.priceUsd) / listing.maxEditions).toLocaleString("en-US", { maximumFractionDigits: 4 })} </span>}
                            <span className={listing.priceUsd != null ? "text-sm font-normal text-muted" : ""}>
                              {Number(formatUnits(BigInt(listing.pricePerEdition), NETWORK.saleCurrency.decimals)).toLocaleString("en-US", { maximumFractionDigits: 6 })}
                            </span>{" "}
                            <span className="text-base font-normal text-muted">{NETWORK.saleCurrency.symbol}</span>
                          </>
                        ) : (
                          <span className="text-base font-normal text-subtle">not listed</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {listing ? (
                    <>
                      {listing.partnerName != null && listing.partnerFeeBps != null && (
                        <SaleSplit partner={{ name: listing.partnerName, feeBps: listing.partnerFeeBps }} />
                      )}
                      <BuyButton listingId={listing.id} />
                    </>
                  ) : (
                    <button disabled className="btn btn-sm mt-4 w-full whitespace-normal">
                      {l.status === "tokenized" ? `Not yet listed on ${NETWORK.chain.name}` : "Awaiting verification"}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
        </section>
      </div>
    </main>
  );
}

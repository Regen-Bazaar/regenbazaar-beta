import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { organizations, impactSubmissions } from "@rb/db/schema";
import type { ImpactDomain } from "@rb/impact-engine";
import { getDb } from "../../lib/db";
import { DOMAIN_KEYS, DOMAIN_LABEL, fmt, impactView, physicalText } from "../../lib/impact-view";

export const metadata = {
  title: "Impact leaderboard",
  description: "Organizations ranked by verified impact, per impact area and overall.",
};

export const dynamic = "force-dynamic";

type Row = {
  orgId: string;
  name: string;
  country: string | null;
  region: string | null;
  verified: boolean;
  total: number;
  claims: number;
  physical: Map<string, number>;
};

// NGOs ranked per impact area (domain score, methodology v0.2) or overall (Impact Value, all versions).
export default async function Leaderboard({ searchParams }: { searchParams: Promise<{ domain?: string }> }) {
  const sp = await searchParams;
  const domain = DOMAIN_KEYS.includes(sp.domain as ImpactDomain) ? (sp.domain as ImpactDomain) : null;
  const db = await getDb();
  const subs = await db
    .select({
      orgId: organizations.id,
      name: organizations.name,
      country: organizations.country,
      region: organizations.region,
      verified: organizations.verified,
      s: impactSubmissions,
    })
    .from(organizations)
    .innerJoin(impactSubmissions, eq(impactSubmissions.orgId, organizations.id))
    .where(inArray(impactSubmissions.status, ["verified", "tokenized"]))
    .limit(5000);

  const byOrg = new Map<string, Row>();
  for (const r of subs) {
    const v = impactView(r.s);
    let value = 0;
    const phys: { amount: number; unit: string }[] = [];
    if (domain) {
      const d = v.domainScores.find((x) => x.domain === domain);
      if (!d) continue;
      value = d.score;
      phys.push(...d.physical);
    } else {
      value = v.iv;
    }
    const row = byOrg.get(r.orgId) ?? {
      orgId: r.orgId, name: r.name, country: r.country, region: r.region, verified: r.verified,
      total: 0, claims: 0, physical: new Map<string, number>(),
    };
    row.total += value;
    row.claims += 1;
    for (const p of phys) row.physical.set(p.unit, (row.physical.get(p.unit) ?? 0) + p.amount);
    byOrg.set(r.orgId, row);
  }
  const rows = [...byOrg.values()].sort((a, b) => b.total - a.total).slice(0, 50);

  const rank = (i: number) => (i === 0 ? "text-accent" : i === 1 ? "text-fg" : i === 2 ? "text-ok" : "text-subtle");
  const top = Math.max(rows[0]?.total ?? 0, 1);
  const tabs: [string, string][] = [...DOMAIN_KEYS.map((d) => [d, DOMAIN_LABEL[d]] as [string, string]), ["", "All (IV)"]];

  return (
    <main className="page-wrap py-10 md:py-14">
      <h1 className="text-[clamp(2.5rem,4vw,3.5rem)]">Impact leaderboard</h1>
      <p className="mt-3 max-w-[70ch] text-lg text-muted">
        Organizations ranked by verified impact. Only verified and on-chain claims count.{" "}
        {domain
          ? `${DOMAIN_LABEL[domain]} uses the domain score and physical units of methodology v0.2 reports.`
          : "All (IV) adds up Impact Value; v0.1 and v0.2 scores are on different scales."}
      </p>

      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Impact area">
        {tabs.map(([key, label]) => {
          const on = (domain ?? "") === key;
          return (
            <Link
              key={key || "all"}
              href={key ? `/leaderboard?domain=${key}` : "/leaderboard"}
              aria-current={on ? "page" : undefined}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                on ? "border-fg bg-fg text-bg" : "border-line-strong text-muted hover:border-accent hover:text-accent"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <div className="card mt-10 p-10 text-center text-muted">
          {domain ? `No verified ${DOMAIN_LABEL[domain].toLowerCase()} reports scored with v0.2 yet.` : "No verified impact yet."}{" "}
          <Link href="/marketplace" className="link">Marketplace</Link>
        </div>
      ) : (
        <ol className="mt-8 max-w-[1100px] space-y-3">
          {rows.map((r, i) => {
            const phys = physicalText([...r.physical].map(([unit, amount]) => ({ unit, amount })));
            return (
              <li key={r.orgId} className="card flex items-center gap-4 px-5 py-5 sm:gap-6 sm:px-6">
                <div className={`w-10 shrink-0 text-center font-display text-4xl leading-none ${rank(i)}`}>{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-lg font-semibold">{r.name}</span>
                    {r.verified && <span className="badge badge-ok shrink-0">verified org</span>}
                  </div>
                  <div className="mt-0.5 text-sm text-subtle">
                    {[r.region, r.country].filter(Boolean).join(", ") || "Location not set"} · {r.claims} verified{" "}
                    {r.claims === 1 ? "claim" : "claims"}
                    {phys ? ` · ${phys}` : ""}
                  </div>
                  <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden="true">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(2, (r.total / top) * 100)}%` }} />
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="label-mono">{domain ? `${DOMAIN_LABEL[domain]} score` : "Total Impact Value"}</div>
                  <div className="text-2xl font-semibold text-accent">{fmt(r.total)}</div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </main>
  );
}

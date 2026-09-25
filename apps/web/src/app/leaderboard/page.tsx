import Link from "next/link";
import { sql, eq, inArray, desc } from "drizzle-orm";
import { organizations, impactSubmissions } from "@rb/db/schema";
import { getDb } from "../../lib/db";

export const dynamic = "force-dynamic";

// NGOs ranked by total verified impact value (the "Fund" stage's trust signal).
export default async function Leaderboard() {
  const db = await getDb();
  const rows = await db
    .select({
      orgId: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      country: organizations.country,
      region: organizations.region,
      verified: organizations.verified,
      totalIv: sql<string>`coalesce(sum(${impactSubmissions.ivValue}), 0)`,
      claims: sql<string>`count(${impactSubmissions.id})`,
    })
    .from(organizations)
    .innerJoin(impactSubmissions, eq(impactSubmissions.orgId, organizations.id))
    .where(inArray(impactSubmissions.status, ["verified", "tokenized"]))
    .groupBy(organizations.id)
    .orderBy(desc(sql`sum(${impactSubmissions.ivValue})`))
    .limit(50);

  const rank = (i: number) => (i === 0 ? "text-accent" : i === 1 ? "text-fg" : i === 2 ? "text-ok" : "text-subtle");
  const top = Math.max(Number(rows[0]?.totalIv ?? 0), 1);

  return (
    <main className="page-wrap py-10 md:py-14">
      <h1 className="text-[clamp(2.5rem,4vw,3.5rem)]">Impact leaderboard</h1>
      <p className="mt-3 max-w-[70ch] text-lg text-muted">
        Organizations ranked by total verified impact value. Only verified and on-chain claims count.
      </p>

      {rows.length === 0 ? (
        <div className="card mt-10 p-10 text-center text-muted">
          No verified impact yet. Approve submissions in the{" "}
          <Link href="/verify" className="link">verification queue</Link>.
        </div>
      ) : (
        <ol className="mt-10 max-w-[1100px] space-y-3">
          {rows.map((r, i) => (
            <li
              key={r.orgId}
              className="card flex items-center gap-4 px-5 py-5 sm:gap-6 sm:px-6"
            >
              <div className={`w-10 shrink-0 text-center font-display text-4xl leading-none ${rank(i)}`}>{i + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-lg font-semibold">{r.name}</span>
                  {r.verified && (
                    <span className="badge badge-ok shrink-0">
                      verified org
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-sm text-subtle">
                  {[r.region, r.country].filter(Boolean).join(", ") || "Location not set"} ·{" "}
                  {Number(r.claims)} verified {Number(r.claims) === 1 ? "claim" : "claims"}
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-raised" aria-hidden="true">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(2, (Number(r.totalIv) / top) * 100)}%` }} />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="label-mono">Total Impact Value</div>
                <div className="text-2xl font-semibold text-accent">{Number(r.totalIv).toLocaleString()}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

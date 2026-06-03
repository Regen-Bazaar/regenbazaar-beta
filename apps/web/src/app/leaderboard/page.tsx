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

  const rank = (i: number) => (i === 0 ? "text-gold" : i === 1 ? "text-paper" : i === 2 ? "text-green-soft" : "text-paper/50");

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-3xl font-bold">Impact leaderboard</h1>
      <p className="mt-2 text-paper/70">
        Organizations ranked by total verified impact value. Only verified and on-chain claims count.
      </p>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-gold/15 bg-ink-soft/40 p-10 text-center text-paper/60">
          No verified impact yet. Approve submissions in the{" "}
          <Link href="/verify" className="text-gold underline">verification queue</Link>.
        </div>
      ) : (
        <ol className="mt-8 space-y-2">
          {rows.map((r, i) => (
            <li
              key={r.orgId}
              className="flex items-center gap-4 rounded-xl border border-gold/15 bg-ink-soft/40 px-5 py-4"
            >
              <div className={`w-8 shrink-0 text-center text-xl font-bold ${rank(i)}`}>{i + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium">{r.name}</span>
                  {r.verified && (
                    <span className="shrink-0 rounded-full bg-green/25 px-2 py-0.5 text-[10px] uppercase tracking-wide text-paper/80">
                      verified org
                    </span>
                  )}
                </div>
                <div className="text-xs text-paper/50">
                  {[r.region, r.country].filter(Boolean).join(", ") || "Location not set"} ·{" "}
                  {Number(r.claims)} verified {Number(r.claims) === 1 ? "claim" : "claims"}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-xs text-paper/45">Total Impact Value</div>
                <div className="font-semibold text-gold">{Number(r.totalIv).toLocaleString()}</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

import Link from "next/link";
import { desc, inArray } from "drizzle-orm";
import { impactSubmissions } from "@rb/db/schema";
import { getDb } from "../../lib/db";

export const dynamic = "force-dynamic";

type Tags = { sdg: string[]; ebf: string[] } | null;

export default async function Marketplace() {
  const db = await getDb();
  const rows = await db
    .select()
    .from(impactSubmissions)
    .where(inArray(impactSubmissions.status, ["verified", "tokenized"]))
    .orderBy(desc(impactSubmissions.ivValue))
    .limit(60);

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="text-3xl font-bold">Marketplace</h1>
      <p className="mt-2 text-paper/70">
        Fund verified real-world impact. Each edition is a fractional share of the claim.
      </p>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-gold/15 bg-ink-soft/40 p-10 text-center text-paper/60">
          No verified impact yet. Approve submissions in the{" "}
          <Link href="/verify" className="text-gold underline">verification queue</Link>.
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((l) => {
            const tags = l.frameworkTags as Tags;
            const tokenized = l.status === "tokenized";
            return (
              <div key={l.id} className="flex flex-col rounded-xl border border-gold/15 bg-ink-soft/40 p-5">
                <div className="mb-3 h-28 rounded-lg bg-gradient-to-br from-green/40 to-ink" />
                <div className="text-xs capitalize text-paper/50">{(l.domain ?? "").replace(/_/g, " ")}</div>
                <Link href={`/submission/${l.id}`} className="mt-1 font-medium leading-snug hover:text-gold">
                  {l.title}
                </Link>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {tags?.sdg.slice(0, 3).map((t) => (
                    <span key={t} className="rounded-full bg-green/25 px-2 py-0.5 text-xs text-paper/80">{t}</span>
                  ))}
                  {tags?.ebf.slice(0, 2).map((t) => (
                    <span key={t} className="rounded-full border border-gold/40 px-2 py-0.5 text-xs text-gold">EBF {t}</span>
                  ))}
                </div>
                <div className="mt-4 flex items-end justify-between">
                  <div>
                    <div className="text-xs text-paper/45">Impact Value</div>
                    <div className="font-semibold text-gold">{Number(l.ivValue ?? 0).toLocaleString()}</div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs ${tokenized ? "bg-green-soft/50 text-paper" : "bg-gold/20 text-gold"}`}
                  >
                    {tokenized ? "on-chain" : "verified"}
                  </span>
                </div>
                <button
                  disabled={!tokenized}
                  className="mt-4 rounded-md border border-gold/40 py-2 text-sm transition-colors enabled:hover:border-gold enabled:hover:text-gold disabled:opacity-50"
                >
                  {tokenized ? "Fund this impact" : "Awaiting on-chain mint"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

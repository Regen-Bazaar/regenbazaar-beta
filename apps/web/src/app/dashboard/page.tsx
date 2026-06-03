import Link from "next/link";
import { desc } from "drizzle-orm";
import { impactSubmissions } from "@rb/db/schema";
import { getDb } from "../../lib/db";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-paper/10 text-paper/60",
  scored: "bg-paper/10 text-paper/60",
  pending_verification: "bg-gold/20 text-gold",
  verified: "bg-green/40 text-paper",
  tokenized: "bg-green-soft/50 text-paper",
  rejected: "bg-red-500/20 text-red-300",
};

type Tags = { sdg: string[]; ebf: string[] } | null;

export default async function Dashboard() {
  const db = await getDb();
  const rows = await db.select().from(impactSubmissions).orderBy(desc(impactSubmissions.createdAt)).limit(100);
  const totalIV = rows.reduce((s, r) => s + Number(r.ivValue ?? 0), 0);
  const tokenized = rows.filter((r) => r.status === "tokenized").length;

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">Your impact</h1>
          <p className="mt-1 text-paper/70">Clean Phangan · NGO dashboard</p>
        </div>
        <Link href="/tokenize" className="rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-ink hover:bg-gold-soft">
          + New tokenization
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Submissions" value={String(rows.length)} />
        <Stat label="Total Impact Value" value={totalIV.toLocaleString()} accent />
        <Stat label="Tokenized" value={String(tokenized)} />
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-gold/15 bg-ink-soft/40 p-10 text-center text-paper/60">
          No submissions yet. <Link href="/tokenize" className="text-gold underline">Tokenize your first impact</Link>.
        </div>
      ) : (
        <div className="mt-10 overflow-hidden rounded-xl border border-gold/15">
          {rows.map((s, i) => {
            const tags = s.frameworkTags as Tags;
            return (
              <Link
                key={s.id}
                href={`/submission/${s.id}`}
                className={`flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-ink-soft/40 ${i ? "border-t border-gold/10" : ""}`}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-paper/50">
                    {s.domain && <span className="capitalize">{s.domain.replace(/_/g, " ")}</span>}
                    {tags?.sdg.slice(0, 4).map((t) => (
                      <span key={t} className="rounded-full bg-green/25 px-2 py-0.5 text-paper/80">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <div className="text-xs text-paper/45">Impact Value</div>
                    <div className="font-semibold text-gold">{Number(s.ivValue ?? 0).toLocaleString()}</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs ${STATUS_STYLES[s.status] ?? ""}`}>
                    {s.status.replace(/_/g, " ")}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-gold/15 bg-ink-soft/40 p-5">
      <div className="text-xs uppercase tracking-wide text-paper/55">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ? "text-gold" : ""}`}>{value}</div>
    </div>
  );
}

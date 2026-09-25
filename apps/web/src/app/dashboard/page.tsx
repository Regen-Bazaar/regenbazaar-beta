import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { impactSubmissions, organizations } from "@rb/db/schema";
import { getDb } from "../../lib/db";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  draft: "badge-muted",
  scored: "badge-muted",
  pending_verification: "badge-gold",
  verified: "badge-ok",
  tokenized: "badge-ok",
  rejected: "badge-danger",
};

type Tags = { sdg: string[]; ebf: string[] } | null;

export default async function Dashboard() {
  const db = await getDb();
  const joined = await db
    .select({ s: impactSubmissions, orgName: organizations.name })
    .from(impactSubmissions)
    .innerJoin(organizations, eq(impactSubmissions.orgId, organizations.id))
    .where(inArray(impactSubmissions.status, ["verified", "tokenized"])) // pending/rejected stay private
    .orderBy(desc(impactSubmissions.createdAt))
    .limit(100);
  const rows = joined.map((j) => ({ ...j.s, orgName: j.orgName }));
  const totalIV = rows.reduce((s, r) => s + Number(r.ivValue ?? 0), 0);
  const tokenized = rows.filter((r) => r.status === "tokenized").length;

  return (
    <main className="page-wrap py-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[clamp(2.5rem,4vw,3.5rem)]">NGO dashboard</h1>
          <p className="mt-3 text-lg text-muted">Approved impact reports. New submissions appear here after review.</p>
        </div>
        <Link href="/tokenize" className="btn btn-primary">
          + New tokenization
        </Link>
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-3">
        <Stat label="Submissions" value={String(rows.length)} />
        <Stat label="Total Impact Value" value={totalIV.toLocaleString()} accent />
        <Stat label="Tokenized" value={String(tokenized)} />
      </div>

      {rows.length === 0 ? (
        <div className="card mt-10 p-10 text-center text-muted">
          No submissions yet. <Link href="/tokenize" className="link">Tokenize your first impact</Link>.
        </div>
      ) : (
        <div className="card mt-10 overflow-hidden">
          {rows.map((s, i) => {
            const tags = s.frameworkTags as Tags;
            return (
              <Link
                key={s.id}
                href={`/submission/${s.id}`}
                className={`flex items-center gap-4 px-4 py-4 transition-colors hover:bg-raised sm:gap-5 sm:px-5 ${i ? "border-t border-line" : ""}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- our own generated SVG */}
                <img src={`/api/submissions/${s.id}/image`} alt="" loading="lazy" className="hidden h-16 w-16 shrink-0 rounded-lg border border-line sm:block" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-semibold">{s.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-subtle">
                    <span className="text-muted">{s.orgName}</span>
                    {s.domain && <span className="capitalize">{s.domain.replace(/_/g, " ")}</span>}
                    {tags?.sdg.slice(0, 4).map((t) => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-6">
                  <div className="text-right">
                    <div className="label-mono">Impact Value</div>
                    <div className="text-xl font-semibold text-accent">{Number(s.ivValue ?? 0).toLocaleString()}</div>
                  </div>
                  <span className={`badge ${STATUS_STYLES[s.status] ?? ""}`}>
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
    <div className="card p-6">
      <div className="label-mono">{label}</div>
      <div className={`mt-2 font-display text-5xl ${accent ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}

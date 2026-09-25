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
    <main className="page-wrap py-12">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-bold">NGO dashboard</h1>
          <p className="mt-1 text-muted">Approved impact reports. New submissions appear here after review.</p>
        </div>
        <Link href="/tokenize" className="btn btn-primary btn-sm">
          + New tokenization
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Submissions" value={String(rows.length)} />
        <Stat label="Total Impact Value" value={totalIV.toLocaleString()} accent />
        <Stat label="Tokenized" value={String(tokenized)} />
      </div>

      {rows.length === 0 ? (
        <div className="mt-10 rounded-xl border border-line bg-surface p-10 text-center text-subtle">
          No submissions yet. <Link href="/tokenize" className="text-accent underline">Tokenize your first impact</Link>.
        </div>
      ) : (
        <div className="mt-10 overflow-hidden rounded-xl border border-line">
          {rows.map((s, i) => {
            const tags = s.frameworkTags as Tags;
            return (
              <Link
                key={s.id}
                href={`/submission/${s.id}`}
                className={`flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-raised ${i ? "border-t border-line" : ""}`}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{s.title}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-subtle">
                    <span className="text-muted">{s.orgName}</span>
                    {s.domain && <span className="capitalize">{s.domain.replace(/_/g, " ")}</span>}
                    {tags?.sdg.slice(0, 4).map((t) => (
                      <span key={t} className="tag">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <div className="text-xs text-subtle">Impact Value</div>
                    <div className="font-semibold text-accent">{Number(s.ivValue ?? 0).toLocaleString()}</div>
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
    <div className="rounded-lg border border-line bg-surface p-5">
      <div className="text-xs uppercase tracking-wide text-subtle">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${accent ? "text-accent" : ""}`}>{value}</div>
    </div>
  );
}

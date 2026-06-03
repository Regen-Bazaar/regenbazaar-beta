import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { impactSubmissions } from "@rb/db/schema";
import { getDb } from "../../../lib/db";

export const dynamic = "force-dynamic";

type Breakdown = {
  actionType: string;
  quantity: number;
  aw: number;
  sm: number;
  tbv: number;
  esm: number;
  pim: number;
  acdm: number;
  raw: number;
};
type IVResult = {
  impactValue: number;
  tablesVersion: string;
  breakdown: Breakdown[];
  frameworkTags: { sdg: string[]; ebf: string[] };
  capped: boolean;
} | null;

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-paper/10 text-paper/60",
  scored: "bg-paper/10 text-paper/60",
  pending_verification: "bg-gold/20 text-gold",
  verified: "bg-green/40 text-paper",
  tokenized: "bg-green-soft/50 text-paper",
  rejected: "bg-red-500/20 text-red-300",
};

export default async function SubmissionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  const [s] = await db.select().from(impactSubmissions).where(eq(impactSubmissions.id, id)).limit(1);
  if (!s) notFound();

  const iv = s.ivResult as IVResult;
  const tags = (s.frameworkTags as { sdg: string[]; ebf: string[] } | null) ?? { sdg: [], ebf: [] };

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/dashboard" className="text-sm text-paper/60 hover:text-gold">
        ← Dashboard
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{s.title}</h1>
          {s.domain && <div className="mt-1 capitalize text-paper/60">{s.domain.replace(/_/g, " ")}</div>}
        </div>
        <span className={`rounded-full px-3 py-1.5 text-sm ${STATUS_STYLES[s.status] ?? ""}`}>
          {s.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <Section title="Report">
            <p className="text-paper/80">{s.description}</p>
          </Section>
          <Section title="Recognised actions">
            <div className="space-y-2">
              {(iv?.breakdown ?? []).map((b) => (
                <div key={b.actionType} className="rounded-md bg-ink-soft/50 px-3 py-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-paper/85">{b.actionType.replace(/_/g, " ")}</span>
                    <span className="text-gold">{b.raw.toLocaleString()}</span>
                  </div>
                  <div className="mt-1 text-xs text-paper/45">
                    {b.quantity} × AW {b.aw} · SM {b.sm} · TBV {b.tbv.toFixed(2)} · ESM {b.esm} · PIM {b.pim} · ACDM {b.acdm.toFixed(2)}
                  </div>
                </div>
              ))}
              {(!iv || iv.breakdown.length === 0) && <p className="text-sm text-paper/45">No recognised actions.</p>}
            </div>
          </Section>
        </div>

        <aside className="h-fit rounded-xl border border-gold/25 bg-ink-soft/50 p-6">
          <div className="text-xs uppercase tracking-wide text-paper/55">Impact Value</div>
          <div className="mt-1 text-4xl font-bold text-gold">{Number(s.ivValue ?? 0).toLocaleString()}</div>
          <div className="mt-1 text-[11px] text-paper/45">
            platform-assessed (beta) · not third-party certified · {s.tablesVersion ?? "—"}
          </div>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {tags.sdg.map((t) => (
              <span key={t} className="rounded-full bg-green/30 px-2.5 py-1 text-xs text-paper">{t}</span>
            ))}
            {tags.ebf.map((t) => (
              <span key={t} className="rounded-full border border-gold/40 px-2.5 py-1 text-xs text-gold">EBF {t}</span>
            ))}
          </div>

          <div className="mt-6 border-t border-gold/15 pt-5">
            {s.status === "verified" ? (
              <>
                <button
                  disabled
                  className="w-full rounded-md bg-gold px-4 py-2.5 text-sm font-semibold text-ink opacity-60"
                >
                  Tokenize as tRWI
                </button>
                <p className="mt-2 text-[11px] text-paper/45">
                  Verified & ready. On-chain mint (EAS attestation → fractional tRWI) activates once contracts are
                  deployed to Celo Sepolia.
                </p>
              </>
            ) : s.status === "tokenized" ? (
              <p className="text-sm text-green-soft">Tokenized on-chain ✓</p>
            ) : (
              <p className="text-sm text-paper/50">
                {s.status === "rejected" ? "Rejected by validator." : "Awaiting validator verification."}
              </p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <div className="mb-2 text-xs uppercase tracking-wide text-paper/55">{title}</div>
      {children}
    </div>
  );
}

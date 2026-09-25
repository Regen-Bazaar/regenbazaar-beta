import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { impactSubmissions, listings, verifications } from "@rb/db/schema";
import { currentNetwork } from "../../../lib/network-server";
import { networkByChainId } from "../../../lib/networks";
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
  draft: "badge-muted",
  scored: "badge-muted",
  pending_verification: "badge-gold",
  verified: "badge-ok",
  tokenized: "badge-ok",
  rejected: "badge-danger",
};

export default async function SubmissionDetail({ params }: { params: Promise<{ id: string }> }) {
  const NETWORK = await currentNetwork();
  const { id } = await params;
  const db = await getDb();
  const [s] = await db.select().from(impactSubmissions).where(eq(impactSubmissions.id, id)).limit(1);
  if (!s) notFound();

  const [lastReview] = await db
    .select()
    .from(verifications)
    .where(eq(verifications.submissionId, id))
    .orderBy(desc(verifications.createdAt))
    .limit(1);

  const [listing] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.submissionId, id), eq(listings.chainId, NETWORK.chain.id)))
    .limit(1);
  // One report, one network: if it is listed elsewhere, point there instead of "not listed".
  const [elsewhere] = listing
    ? []
    : await db.select({ chainId: listings.chainId }).from(listings).where(eq(listings.submissionId, id)).limit(1);
  const otherNet = elsewhere ? networkByChainId(elsewhere.chainId) : undefined;
  const explorer = NETWORK.chain.blockExplorers?.default.url ?? "";

  const iv = s.ivResult as IVResult;
  const tags = (s.frameworkTags as { sdg: string[]; ebf: string[] } | null) ?? { sdg: [], ebf: [] };

  return (
    <main className="page-wrap py-10 md:py-14">
      <Link href="/dashboard" className="text-muted hover:text-accent">
        ← Dashboard
      </Link>

      <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {s.domain && <div className="label-mono">{s.domain.replace(/_/g, " ")}</div>}
          <h1 className="mt-2 max-w-[24ch] text-[clamp(2.25rem,4vw,3.5rem)]">{s.title}</h1>
        </div>
        <span className={`badge mt-1 ${STATUS_STYLES[s.status] ?? ""}`}>
          {s.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_420px] xl:grid-cols-[minmax(0,1fr)_460px] xl:gap-16">
        <div className="max-w-[72ch]">
          <Section title="Report">
            <p className="text-lg leading-relaxed">{s.description}</p>
          </Section>
          {lastReview?.note && (
            <Section title="Validator note">
              <div
                className={`rounded-xl border px-4 py-3 ${
                  lastReview.decision === "reject"
                    ? "border-danger/40 bg-danger-tint text-danger"
                    : "border-line bg-surface text-muted"
                }`}
              >
                <span className="capitalize">{lastReview.decision.replace(/_/g, " ")}</span>: {lastReview.note}
              </div>
            </Section>
          )}
          {Array.isArray(s.mediaUris) && (s.mediaUris as string[]).length > 0 && (
            <Section title="Evidence">
              <ul className="space-y-1">
                {(s.mediaUris as string[]).map((u) => (
                  <li key={u} className="break-all">
                    <a href={u} target="_blank" rel="noopener noreferrer nofollow ugc" className="link">
                      {u}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-sm text-subtle">External links provided by the organisation, not hosted or checked by us.</p>
            </Section>
          )}
          <Section title="Recognised actions">
            <div className="space-y-3">
              {(iv?.breakdown ?? []).map((b) => (
                <div key={b.actionType} className="card px-4 py-3">
                  <div className="flex justify-between gap-4">
                    <span className="font-semibold capitalize">{b.actionType.replace(/_/g, " ")}</span>
                    <span className="font-semibold text-accent">{b.raw.toLocaleString()}</span>
                  </div>
                  <div className="mt-1 font-mono text-sm text-subtle">
                    {b.quantity} × AW {b.aw} · SM {b.sm} · TBV {b.tbv.toFixed(2)} · ESM {b.esm} · PIM {b.pim} · ACDM {b.acdm.toFixed(2)}
                  </div>
                </div>
              ))}
              {(!iv || iv.breakdown.length === 0) && <p className="text-subtle">No recognised actions.</p>}
            </div>
          </Section>
        </div>

        <aside className="card p-6 lg:sticky lg:top-24">
          {(s.status === "verified" || s.status === "tokenized") && (
            // eslint-disable-next-line @next/next/no-img-element -- our own generated SVG
            <img src={`/api/submissions/${s.id}/image`} alt="tRWI card" className="art mb-6 aspect-square w-full" />
          )}
          <div className="label-mono">Impact Value</div>
          <div className="mt-1 font-display text-5xl text-accent">{Number(s.ivValue ?? 0).toLocaleString()}</div>
          <div className="mt-2 text-sm text-subtle">
            platform-assessed (beta) · not third-party certified · {s.tablesVersion ?? "n/a"}
          </div>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {tags.sdg.map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
            {tags.ebf.map((t) => (
              <span key={t} className="tag tag-ebf">EBF {t}</span>
            ))}
          </div>

          <div className="mt-6 border-t border-line pt-5">
            {listing ? (
              <div className="space-y-2 text-sm">
                <p className="text-base font-semibold text-ok">Attested and listed on {NETWORK.chain.name} ✓</p>
                <p className="text-muted">
                  tRWI #{String(listing.tokenId)} ·{" "}
                  <a
                    href={`${explorer}/token/${NETWORK.trwi}/instance/${String(listing.tokenId)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 hover:text-accent"
                  >
                    token on explorer
                  </a>{" "}
                  (appears after the first purchase)
                </p>
                <p className="break-all text-muted">
                  EAS attestation UID {listing.easUid} ·{" "}
                  <a
                    href={`${explorer}/address/${NETWORK.eas}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-4 hover:text-accent"
                  >
                    EAS contract
                  </a>
                </p>
                <p className="break-all text-muted">Metadata {listing.metadataUri}</p>
                <Link href="/marketplace" className="btn btn-primary !mt-4 w-full">
                  Fund this impact
                </Link>
              </div>
            ) : otherNet ? (
              <p className="text-muted">
                Listed on {otherNet.chain.name}.{" "}
                <a href={`/submission/${s.id}?network=${otherNet.key}`} className="link">
                  Switch to {otherNet.chain.name}
                </a>
              </p>
            ) : s.status === "verified" || s.status === "tokenized" ? (
              <p className="text-muted">Verified. Not listed on {NETWORK.chain.name} yet.</p>
            ) : (
              <p className="text-muted">
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
    <section className="mb-10">
      <h2 className="label-mono mb-3">{title}</h2>
      {children}
    </section>
  );
}

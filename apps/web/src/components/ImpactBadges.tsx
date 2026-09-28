import type { DomainScoreV02, ProofLevel } from "@rb/impact-engine";
import { DOMAIN_LABEL, fmt, physicalText } from "../lib/impact-view";

const PROOF_TITLE: Record<ProofLevel, string> = {
  P0: "P0: text only (not listed)",
  P1: "P1: public trace",
  P2: "P2: media with date and place, or two independent traces",
  P3: "P3: a second party confirms",
  P4: "P4: measurement or registry record",
};

export function ProofBadge({ level, link = true }: { level: ProofLevel | null; link?: boolean }) {
  if (!level) return <span className="tag" title="Proof level is set by a validator">P pending</span>;
  if (!link) return <span className="tag" title={PROOF_TITLE[level]}>{level}</span>;
  return (
    <a href="/methodology#proof" className="tag hover:text-accent" title={PROOF_TITLE[level]}>
      {level}
    </a>
  );
}

export function VersionBadge({ version, link = true }: { version: "v0.1" | "v0.2"; link?: boolean }) {
  if (!link) return <span className="tag">{version}</span>;
  return (
    <a href="/methodology#versions" className="tag hover:text-accent" title={`Scored with methodology ${version}`}>
      {version}
    </a>
  );
}

/** Domain score tiles: score, physical units, and the domain coefficient behind the single IV. */
export function DomainScores({ scores }: { scores: DomainScoreV02[] }) {
  if (!scores.length) return <p className="text-sm text-subtle">No recognised actions yet.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {scores.map((d) => (
        <div key={d.domain} className="rounded-xl bg-raised px-4 py-3">
          <div className="label-mono">{DOMAIN_LABEL[d.domain]}</div>
          <div className="mt-1 font-display text-3xl text-accent">{fmt(d.score)}</div>
          <div className="mt-1 text-sm text-subtle">{physicalText(d.physical, 3) || "score"}</div>
        </div>
      ))}
    </div>
  );
}

// One place that turns a stored submission into what screens show. v0.2 rows lead with the primary
// domain score and physical units; v0.1 rows keep showing their Impact Value as scored at the time.

import type { DomainScoreV02, ImpactDomain, ProofLevel } from "@rb/impact-engine";
import { parseProofLevel } from "@rb/impact-engine";

export const DOMAIN_LABEL: Record<ImpactDomain, string> = {
  environment: "Environment",
  animal_welfare: "Animal welfare",
  education: "Education",
  poverty: "Poverty",
  social: "Social",
  health: "Health",
};

export const DOMAIN_KEYS = Object.keys(DOMAIN_LABEL) as ImpactDomain[];

export function fmt(n: number, max = 1): string {
  if (!Number.isFinite(n)) return "0";
  return n >= 1000 ? Math.round(n).toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: max });
}

// Units that best describe a domain's result, most meaningful first.
const UNIT_ORDER = ["tCO2e/yr", "tCO2e", "ha", "kg", "person-days", "fragments", "animals", "students", "people", "FTE", "families", "patients"];

export function physicalText(physical: { amount: number; unit: string }[], limit = 2): string {
  const sorted = [...physical].sort((a, b) => {
    const ia = UNIT_ORDER.indexOf(a.unit);
    const ib = UNIT_ORDER.indexOf(b.unit);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return sorted
    .slice(0, limit)
    .map((p) => `${p.unit.startsWith("tCO2e") ? "≈ " : ""}${fmt(p.amount)} ${p.unit}`)
    .join(" · ");
}

export interface ImpactRowLike {
  methodologyVersion?: string | null;
  domainScores?: unknown;
  ivValue?: string | number | null;
  proofLevel?: string | null;
  domain?: string | null;
  tablesVersion?: string | null;
}

export interface ImpactView {
  version: "v0.1" | "v0.2";
  iv: number;
  domainScores: DomainScoreV02[];
  primary: DomainScoreV02 | null;
  proofLevel: ProofLevel | null;
  tablesVersion: string;
}

export function impactView(row: ImpactRowLike): ImpactView {
  const v02 = row.methodologyVersion === "v0.2";
  const domainScores = v02 && Array.isArray(row.domainScores) ? (row.domainScores as DomainScoreV02[]) : [];
  const primary = [...domainScores].sort((a, b) => b.weighted - a.weighted)[0] ?? null;
  return {
    version: v02 ? "v0.2" : "v0.1",
    iv: Number(row.ivValue ?? 0) || 0,
    domainScores,
    primary,
    proofLevel: v02 ? parseProofLevel(row.proofLevel) : null,
    tablesVersion: row.tablesVersion ?? "",
  };
}

/** Headline for cards: "Environment · 28.8" plus "≈ 27.7 tCO2e/yr · 1.2 ha" for v0.2; "IV 150" for v0.1. */
export function headline(v: ImpactView): { label: string; value: string; sub: string } {
  if (v.version === "v0.2" && v.primary) {
    return { label: `${DOMAIN_LABEL[v.primary.domain]} score`, value: fmt(v.primary.score), sub: physicalText(v.primary.physical) };
  }
  return { label: "Impact Value", value: fmt(v.iv), sub: v.version === "v0.1" ? "methodology v0.1" : "" };
}

/** Physical totals by domain across many rows (home page, dashboard). */
export function sumPhysical(rows: ImpactRowLike[]): Map<ImpactDomain, Map<string, number>> {
  const out = new Map<ImpactDomain, Map<string, number>>();
  for (const r of rows) {
    for (const d of impactView(r).domainScores) {
      const m = out.get(d.domain) ?? new Map<string, number>();
      for (const p of d.physical) m.set(p.unit, (m.get(p.unit) ?? 0) + p.amount);
      out.set(d.domain, m);
    }
  }
  return out;
}

/** Headline for the generated tRWI card (same on the site and in the IPFS image). Null for v0.1 rows. */
export function cardHeadline(row: ImpactRowLike): { score: number; domain: string; physical: string | null } | null {
  const v = impactView(row);
  if (v.version !== "v0.2" || !v.primary) return null;
  return { score: v.primary.score, domain: v.primary.domain, physical: physicalText(v.primary.physical, 1) || null };
}

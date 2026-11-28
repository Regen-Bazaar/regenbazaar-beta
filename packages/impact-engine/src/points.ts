// Impact points per area (gamification v1). Fixed rules, no AI: the same input gives the same result.
// A buyer's points in an area = for every edition held or retired: the tRWI's score in that area, divided by
// the number of editions of that tRWI, multiplied by its proof factor. Areas are never added together.

import type { ImpactDomain } from "./types.ts";
import { parseProofLevel, proofFactor } from "./proof.ts";

export const IMPACT_AREAS: readonly ImpactDomain[] = ["environment", "animal_welfare", "education", "poverty", "social", "health"];

export type AreaPoints = Record<ImpactDomain, number>;

/**
 * Proof factor of an impact scored before proof levels existed (methodology v0.1, no level). It counts like
 * the lowest listable level. Pilot hypothesis, like the factors themselves.
 */
export const UNGRADED_PROOF_FACTOR = proofFactor("P1");

/** What the points rule needs to know about one tRWI. */
export interface PointsImpact {
  methodologyVersion: string | null; // "v0.2" or null (v0.1)
  domain: string | null; // area the impact is filed under
  ivValue: number; // v0.1 total
  domainScores: unknown; // v0.2: [{ domain, score }]
  proofLevel: string | null; // "P1".."P4", null = not graded
  maxEditions: number;
  withdrawn: boolean; // a withdrawn tRWI gives zero
  creatorWallets: string[]; // payout wallet and organisation wallet: a creator earns no buyer points on own tRWI
}

export interface PointsHolding {
  editionsHeld: number;
  editionsRetired: number;
  impact: PointsImpact;
}

export function emptyAreaPoints(): AreaPoints {
  return { environment: 0, animal_welfare: 0, education: 0, poverty: 0, social: 0, health: 0 };
}

const isArea = (x: unknown): x is ImpactDomain => typeof x === "string" && (IMPACT_AREAS as readonly string[]).includes(x);
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Score of one tRWI in each area it touches. v0.1 has one total, counted in the area it is filed under. */
export function areaScores(impact: Pick<PointsImpact, "methodologyVersion" | "domain" | "ivValue" | "domainScores">): Partial<AreaPoints> {
  const out: Partial<AreaPoints> = {};
  if (impact.methodologyVersion === "v0.2") {
    if (!Array.isArray(impact.domainScores)) return out;
    for (const d of impact.domainScores as { domain?: unknown; score?: unknown }[]) {
      const score = Number(d?.score);
      if (isArea(d?.domain) && Number.isFinite(score) && score > 0) out[d.domain] = (out[d.domain] ?? 0) + score;
    }
    return out;
  }
  if (isArea(impact.domain) && Number.isFinite(impact.ivValue) && impact.ivValue > 0) out[impact.domain] = impact.ivValue;
  return out;
}

/** Proof factor used for points: the level's factor, or the ungraded factor for v0.1. */
export function pointsProofFactor(impact: Pick<PointsImpact, "methodologyVersion" | "proofLevel">): number {
  const level = parseProofLevel(impact.proofLevel);
  if (level) return proofFactor(level);
  return impact.methodologyVersion === "v0.2" ? 0 : UNGRADED_PROOF_FACTOR;
}

/** Points one edition of this tRWI gives in each area ("gives you +0.24 Environment"). Zero when withdrawn. */
export function pointsPerEdition(impact: PointsImpact): AreaPoints {
  const out = emptyAreaPoints();
  if (impact.withdrawn || !(impact.maxEditions > 0)) return out;
  const factor = pointsProofFactor(impact);
  for (const [area, score] of Object.entries(areaScores(impact)) as [ImpactDomain, number][]) {
    out[area] = round6((score / impact.maxEditions) * factor);
  }
  return out;
}

/** Points of one holding: held and retired editions count the same; retired ones are permanent. */
export function holdingPoints(wallet: string, h: PointsHolding): AreaPoints {
  const out = emptyAreaPoints();
  const w = wallet.toLowerCase();
  if (h.impact.creatorWallets.some((c) => c.toLowerCase() === w)) return out;
  const editions = Math.max(0, h.editionsHeld) + Math.max(0, h.editionsRetired);
  if (editions === 0) return out;
  const per = pointsPerEdition(h.impact);
  for (const area of IMPACT_AREAS) out[area] = round6(per[area] * editions);
  return out;
}

/** A buyer's points in each area over all their holdings. */
export function buyerPoints(wallet: string, holdings: PointsHolding[]): AreaPoints {
  const out = emptyAreaPoints();
  for (const h of holdings) {
    const p = holdingPoints(wallet, h);
    for (const area of IMPACT_AREAS) out[area] += p[area];
  }
  for (const area of IMPACT_AREAS) out[area] = round6(out[area]);
  return out;
}

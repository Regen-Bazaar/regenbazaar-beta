// Price v0.2 (owner, 2026-10-01): Impact Value sets the price; declared costs only raise it.
//
//   price (USD) = IV × rate × P × E                  split across editions
//
// P = proof level factor (proof.ts). E = cost coefficient from 1.0 to 1.5: the group's declared costs (cost-v02.ts)
// raise the price of its impact by at most 50%; they are never added as dollars. No declared cost → E = 1.0.
// The +50% cap is set for this methodology version; it is not calibrated. v0.1 price.ts stays for old listings.

import type { SourcedValue } from "./types-v02.ts";
import { isListable, proofFactor, type ProofLevel } from "./proof.ts";
import { costToUsd, type CostDeclaration } from "./cost-v02.ts";

export const PRICE_MODEL_VERSION_V02 = "v0.2-iv-cost-2026-10";

/** USD per IV point. Provisional; refined later from the costs groups declare. */
export const PRICE_RATE_USD_PER_IV: SourcedValue = {
  value: 1.0,
  status: "assumption",
  source: "provisional; refined later from declared costs",
  needsCheck: true,
};

export const EFFORT_MAX_UPLIFT = 0.5; // E ≤ 1.5

/** E = 1 + 0.5 × min(1, declared cost ÷ base price of the impact). */
export function effortFactor(costUsd: number, baseUsd: number): number {
  if (!(costUsd > 0) || !(baseUsd > 0)) return 1;
  return 1 + EFFORT_MAX_UPLIFT * Math.min(1, costUsd / baseUsd);
}

export interface PriceResultV02 {
  totalUsd: number;
  perEditionUsd: number;
  impactValue: number;
  rate: number;
  proofLevel: ProofLevel;
  p: number;
  e: number;
  costUsd: number | null;
  editions: number;
  modelVersion: string;
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/** Null when the report cannot be listed (P0 or no level). A cost in an unknown currency counts as no cost. */
export function computePriceV02(
  impactValue: number,
  proofLevel: ProofLevel | null | undefined,
  cost?: CostDeclaration | null,
  editions = 1,
): PriceResultV02 | null {
  if (!proofLevel || !isListable(proofLevel)) return null;
  const eds = Number.isInteger(editions) && editions > 0 ? editions : 1;
  const iv = Number.isFinite(impactValue) && impactValue > 0 ? impactValue : 0;
  const rate = PRICE_RATE_USD_PER_IV.value;
  const base = iv * rate;
  const costUsd = cost ? (costToUsd(cost)?.totalUsd ?? null) : null;
  const e = effortFactor(costUsd ?? 0, base);
  const p = proofFactor(proofLevel);
  const totalUsd = round(base * p * e);
  return {
    totalUsd,
    perEditionUsd: round(totalUsd / eds),
    impactValue: iv,
    rate,
    proofLevel,
    p,
    e: round(e),
    costUsd,
    editions: eds,
    modelVersion: PRICE_MODEL_VERSION_V02,
  };
}

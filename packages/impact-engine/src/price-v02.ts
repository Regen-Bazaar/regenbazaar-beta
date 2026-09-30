// Price v0.2 (owner decision D4, 2026-09-28): price in USD = IV × rate × P × C, split across editions.
// P = proof level factor (proof.ts), C = complexity of the work (the former ACDM answers, 1.0 to 1.4).
// Primary sales settle in a stablecoin at this USD price; the secondary market is free.
// v0.1 price.ts stays unchanged for listings made before v0.2.

import type { ComplexityAnswers } from "./types.ts";
import type { SourcedValue } from "./types-v02.ts";
import { actionComplexity } from "./tables.ts";
import { isListable, proofFactor, type ProofLevel } from "./proof.ts";

export const PRICE_MODEL_VERSION_V02 = "v0.2-usd-2026-09";

/** USD per IV point, used only for reports without a cost declaration (cost-v02.ts prices the rest). Platform value. */
export const PRICE_RATE_USD_PER_IV: SourcedValue = {
  value: 1.0,
  status: "assumption",
  source: "platform value; fallback for reports without a cost declaration",
  needsCheck: true,
};

export const COMPLEXITY_MIN = 1.0;
export const COMPLEXITY_MAX = 1.4;

/** C: average of the five complexity answers (same scales as v0.1 ACDM), 1.0 when not answered. */
export function complexityFactor(c?: ComplexityAnswers | null): number {
  const v = c ? actionComplexity(c) : 1.0;
  return Number.isFinite(v) ? Math.min(Math.max(v, COMPLEXITY_MIN), COMPLEXITY_MAX) : 1.0;
}

export interface PriceResultV02 {
  totalUsd: number;
  perEditionUsd: number;
  impactValue: number;
  rate: number;
  proofLevel: ProofLevel;
  p: number;
  c: number;
  editions: number;
  modelVersion: string;
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

/** Null when the report cannot be listed (P0 or no level). */
export function computePriceV02(
  impactValue: number,
  proofLevel: ProofLevel | null | undefined,
  complexity?: ComplexityAnswers | null,
  editions = 1,
): PriceResultV02 | null {
  if (!proofLevel || !isListable(proofLevel)) return null;
  const eds = Number.isInteger(editions) && editions > 0 ? editions : 1;
  const iv = Number.isFinite(impactValue) && impactValue > 0 ? impactValue : 0;
  const p = proofFactor(proofLevel);
  const c = complexityFactor(complexity);
  const totalUsd = round(iv * PRICE_RATE_USD_PER_IV.value * p * c);
  return {
    totalUsd,
    perEditionUsd: round(totalUsd / eds),
    impactValue: iv,
    rate: PRICE_RATE_USD_PER_IV.value,
    proofLevel,
    p,
    c: round(c),
    editions: eds,
    modelVersion: PRICE_MODEL_VERSION_V02,
  };
}

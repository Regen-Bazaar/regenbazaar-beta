// Deterministic, auditable Impact Value scoring. The LLM (if used) only parses free text into
// ExtractedAction[]; the SCORE here is a pure function of (actions, context, tables version) — no LLM,
// no randomness, no wall-clock. Same inputs + same TABLES_VERSION => same IV (audit-stable).

import type {
  ExtractedAction,
  ImpactContext,
  IVResult,
  ActionBreakdown,
  FrameworkTags,
} from "./types.ts";
import {
  ACTION_WEIGHTS,
  TABLES_VERSION,
  MAX_ACTION_QUANTITY,
  scopeMultiplier,
  timeBasedValue,
  environmentalSensitivity,
  populationImpact,
  actionComplexity,
} from "./tables.ts";

export function computeImpactValue(actions: ExtractedAction[], ctx: ImpactContext = {}): IVResult {
  const tbv = timeBasedValue(ctx.periodStart, ctx.periodEnd);
  const acdm = actionComplexity(ctx.complexity);
  const pim = populationImpact(ctx.populationDensity);

  const breakdown: ActionBreakdown[] = [];
  const sdgSet = new Set<string>();
  const ebfSet = new Set<string>();
  let capped = false;
  let total = 0;

  for (const a of actions) {
    const w = ACTION_WEIGHTS[a.actionType];
    if (!w) continue; // unknown action types contribute 0 until added to the reference table

    let qty = a.quantity;
    let clampedQuantity = false;
    if (!Number.isFinite(qty) || qty < 0) qty = 0;
    if (qty > MAX_ACTION_QUANTITY) {
      qty = MAX_ACTION_QUANTITY;
      clampedQuantity = true;
      capped = true;
    }

    const sm = scopeMultiplier(qty);
    const esm = w.domain === "environment" ? environmentalSensitivity(ctx.regionCode) : 1.0;
    const raw = w.aw * qty * sm * tbv * esm * pim * acdm;
    total += raw;

    for (const s of w.sdg) sdgSet.add(s);
    if (w.ebf) for (const e of w.ebf) ebfSet.add(e);

    breakdown.push({
      actionType: a.actionType,
      quantity: qty,
      aw: w.aw,
      sm,
      tbv,
      esm,
      pim,
      acdm,
      raw: round(raw),
      clampedQuantity,
    });
  }

  const frameworkTags: FrameworkTags = { sdg: [...sdgSet].sort(), ebf: [...ebfSet].sort() };
  return {
    impactValue: round(total),
    tablesVersion: TABLES_VERSION,
    breakdown,
    frameworkTags,
    capped,
  };
}

function round(n: number): number {
  return Math.round(n * 1e4) / 1e4;
}

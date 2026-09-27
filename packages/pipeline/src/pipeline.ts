// Impact pipeline: submit -> extract -> deterministic score -> persist into the verification queue.
// Wires @rb/impact-engine (the moat) to @rb/db. The LLM (if provided) ONLY extracts; its output is
// sanitized/validated before it reaches the deterministic scorer or the DB — the score is never the LLM's.

import {
  ACDM_SCALES,
  ESM_BY_REGION,
  PIM_BY_DENSITY,
  computeImpactValue,
  ruleBasedExtract,
  type ComplexityAnswers,
  type ExtractedAction,
  type ImpactContext,
  type LLMExtractor,
  type PopulationDensity,
} from "@rb/impact-engine";
import { impactSubmissions } from "@rb/db/schema";
import type { DB } from "@rb/db";

export type SubmissionDomain =
  | "environment"
  | "animal_welfare"
  | "education"
  | "poverty"
  | "social"
  | "health";

export interface SubmissionInput {
  orgId: string;
  title: string;
  description: string; // NGO free text
  domain?: SubmissionDomain;
  context?: ImpactContext;
  mediaUris?: string[];
  chainId?: number; // network the report will be listed on (one chain only)
}

const DOMAINS: readonly SubmissionDomain[] = ["environment", "animal_welfare", "education", "poverty", "social", "health"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** Validate the client-supplied domain against the DB enum (absent = no domain). */
export function parseDomain(raw: unknown): Parsed<SubmissionDomain | undefined> {
  if (raw === undefined || raw === null || raw === "") return { ok: true, value: undefined };
  if (typeof raw === "string" && (DOMAINS as readonly string[]).includes(raw)) {
    return { ok: true, value: raw as SubmissionDomain };
  }
  return { ok: false, error: "domain is not one of the supported impact domains" };
}

/**
 * Validate the client-supplied scoring context against the engine's tables, so an unknown value can never
 * reach the formula (an unknown complexity answer used to turn IV into NaN). Every field stays optional.
 */
export function parseContext(raw: unknown): Parsed<ImpactContext> {
  if (raw === undefined || raw === null) return { ok: true, value: {} };
  if (typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "context must be an object" };
  const c = raw as Record<string, unknown>;
  const out: ImpactContext = {};

  if (c.regionCode !== undefined && c.regionCode !== "") {
    if (typeof c.regionCode !== "string" || !Object.hasOwn(ESM_BY_REGION, c.regionCode)) {
      return { ok: false, error: "context.regionCode is not a supported region" };
    }
    out.regionCode = c.regionCode;
  }
  if (c.populationDensity !== undefined && c.populationDensity !== "") {
    if (typeof c.populationDensity !== "string" || !Object.hasOwn(PIM_BY_DENSITY, c.populationDensity)) {
      return { ok: false, error: "context.populationDensity is not a supported value" };
    }
    out.populationDensity = c.populationDensity as PopulationDensity;
  }
  if (c.complexity !== undefined) {
    if (typeof c.complexity !== "object" || c.complexity === null || Array.isArray(c.complexity)) {
      return { ok: false, error: "context.complexity must be an object" };
    }
    const answers = c.complexity as Record<string, unknown>;
    const complexity: Record<string, string> = {};
    for (const [question, scale] of Object.entries(ACDM_SCALES)) {
      const v = answers[question];
      if (typeof v !== "string" || !Object.hasOwn(scale, v)) {
        return { ok: false, error: `context.complexity.${question} is missing or not a supported answer` };
      }
      complexity[question] = v;
    }
    out.complexity = complexity as unknown as ComplexityAnswers;
  }
  for (const key of ["periodStart", "periodEnd"] as const) {
    const v = c[key];
    if (v === undefined || v === "") continue;
    if (typeof v !== "string" || !ISO_DATE.test(v) || Number.isNaN(Date.parse(v))) {
      return { ok: false, error: `context.${key} must be a date (YYYY-MM-DD)` };
    }
    out[key] = v;
  }
  if (out.periodStart && out.periodEnd && out.periodEnd < out.periodStart) {
    return { ok: false, error: "context.periodEnd is before context.periodStart" };
  }
  return { ok: true, value: out };
}

export interface ProcessOptions {
  /** Optional LLM extractor; falls back to deterministic rule-based extraction when absent. */
  extractor?: LLMExtractor;
}

/** Validate extractor output before it touches scoring or the DB (defense for LLM output). */
export function sanitizeActions(actions: unknown): ExtractedAction[] {
  if (!Array.isArray(actions)) return [];
  const out: ExtractedAction[] = [];
  for (const a of actions) {
    if (
      a &&
      typeof a.actionType === "string" &&
      a.actionType.length > 0 &&
      a.actionType.length <= 60 &&
      typeof a.quantity === "number" &&
      Number.isFinite(a.quantity) &&
      a.quantity > 0 &&
      typeof a.unit === "string" &&
      a.unit.length <= 30
    ) {
      out.push({ actionType: a.actionType, quantity: a.quantity, unit: a.unit });
    }
  }
  return out;
}

export async function processSubmission(db: DB, input: SubmissionInput, opts: ProcessOptions = {}) {
  let actions: ExtractedAction[];
  if (opts.extractor) {
    // LLM extraction, with a deterministic rule-based fallback on error or empty output.
    try {
      actions = sanitizeActions(await opts.extractor.extract(input.description));
      if (actions.length === 0) actions = ruleBasedExtract(input.description);
    } catch {
      actions = ruleBasedExtract(input.description);
    }
  } else {
    actions = ruleBasedExtract(input.description);
  }

  const iv = computeImpactValue(actions, input.context ?? {});

  const [submission] = await db
    .insert(impactSubmissions)
    .values({
      orgId: input.orgId,
      title: input.title,
      description: input.description,
      domain: input.domain,
      status: "pending_verification",
      extractedActions: actions,
      context: input.context ?? {},
      ivResult: iv,
      ivValue: iv.impactValue.toFixed(4),
      tablesVersion: iv.tablesVersion,
      frameworkTags: iv.frameworkTags,
      mediaUris: input.mediaUris ?? [],
      chainId: input.chainId ?? null,
    })
    .returning();

  return { submission, iv };
}

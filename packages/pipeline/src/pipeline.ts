// Impact pipeline: submit -> extract -> deterministic score -> persist into the verification queue.
// Wires @rb/impact-engine (the moat) to @rb/db. The LLM (if provided) ONLY extracts; its output is
// sanitized/validated before it reaches the deterministic scorer or the DB — the score is never the LLM's.

import {
  computeImpactValue,
  ruleBasedExtract,
  type ExtractedAction,
  type ImpactContext,
  type LLMExtractor,
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
  const actions: ExtractedAction[] = opts.extractor
    ? sanitizeActions(await opts.extractor.extract(input.description))
    : ruleBasedExtract(input.description);

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
    })
    .returning();

  return { submission, iv };
}

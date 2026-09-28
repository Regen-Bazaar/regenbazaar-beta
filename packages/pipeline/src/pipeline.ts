// Impact pipeline: submit -> extract -> deterministic score -> persist into the verification queue.
// Wires @rb/impact-engine (the moat) to @rb/db. The LLM (if provided) ONLY extracts; its output is
// sanitized/validated before it reaches the deterministic scorer or the DB — the score is never the LLM's.

import {
  ACDM_SCALES,
  ACTION_WEIGHTS_V02,
  ESM_BY_REGION,
  PIM_BY_DENSITY,
  computeImpactValue,
  computeImpactValueV02,
  ruleBasedExtract,
  type ComplexityAnswers,
  type Ecosystem,
  type ExtractedAction,
  type ExtractedActionV02,
  type ImpactContext,
  type ImpactContextV02,
  type LLMExtractor,
  type MethodologyVersion,
  type PopulationDensity,
  type RegistryDeclaration,
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
  // v0.2 fields (all optional; validated by the parse* helpers below before they get here)
  location?: SubmissionLocation | null;
  proofLinks?: string[];
  registry?: RegistryDeclaration | null;
  // Actions as checked and corrected by the submitter (form step 2). v0.2 scores these; the AI's own
  // reading is stored next to them so a validator sees every edit.
  declaredActions?: unknown;
}

export interface SubmissionLocation {
  lat: number;
  lon: number;
  ecosystem?: Ecosystem;
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

export const ECOSYSTEMS: readonly Ecosystem[] = ["mangrove", "forest", "coral_reef", "seagrass", "grassland", "urban", "coast", "other"];
export const REGISTRY_STANDARDS = ["none", "verra", "gold_standard", "plan_vivo", "hypercerts", "other"] as const;
export const MAX_PROOF_LINKS = 10;
const ISO_COUNTRY = /^[A-Z]{2}$/;
const SERIAL = /^[A-Za-z0-9._:\/ -]{1,100}$/;

/**
 * v0.2 context: the v0.1 keys stay accepted (complexity is used by the price, period is kept as data),
 * plus country, ecosystem and habitat adjacency. ESM is never taken from the NGO: a validator confirms it.
 */
export function parseContextV02(raw: unknown): Parsed<ImpactContext & ImpactContextV02> {
  const base = parseContext(raw);
  if (!base.ok) return base;
  const c = (raw ?? {}) as Record<string, unknown>;
  const out: ImpactContext & ImpactContextV02 = { ...base.value };
  if (c.country !== undefined && c.country !== "") {
    const v = typeof c.country === "string" ? c.country.toUpperCase() : "";
    if (!ISO_COUNTRY.test(v)) return { ok: false, error: "context.country must be a 2-letter country code" };
    out.country = v;
  }
  if (c.ecosystem !== undefined && c.ecosystem !== "") {
    if (typeof c.ecosystem !== "string" || !(ECOSYSTEMS as readonly string[]).includes(c.ecosystem)) {
      return { ok: false, error: "context.ecosystem is not a supported ecosystem" };
    }
    out.ecosystem = c.ecosystem as Ecosystem;
  }
  if (c.adjacentToHabitat !== undefined) {
    if (typeof c.adjacentToHabitat !== "boolean") return { ok: false, error: "context.adjacentToHabitat must be true or false" };
    out.adjacentToHabitat = c.adjacentToHabitat;
  }
  return { ok: true, value: out };
}

/** Site coordinates (WGS84) and optional ecosystem. Absent = no location. */
export function parseLocation(raw: unknown): Parsed<SubmissionLocation | undefined> {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "location must be an object" };
  const l = raw as Record<string, unknown>;
  const lat = l.lat;
  const lon = l.lon;
  if (typeof lat !== "number" || !Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { ok: false, error: "location.lat must be a number between -90 and 90" };
  }
  if (typeof lon !== "number" || !Number.isFinite(lon) || lon < -180 || lon > 180) {
    return { ok: false, error: "location.lon must be a number between -180 and 180" };
  }
  const out: SubmissionLocation = { lat, lon };
  if (l.ecosystem !== undefined && l.ecosystem !== "") {
    if (typeof l.ecosystem !== "string" || !(ECOSYSTEMS as readonly string[]).includes(l.ecosystem)) {
      return { ok: false, error: "location.ecosystem is not a supported ecosystem" };
    }
    out.ecosystem = l.ecosystem as Ecosystem;
  }
  return { ok: true, value: out };
}

/**
 * Public proof links: https only, no credentials, at most MAX_PROOF_LINKS, deduplicated. This is a
 * syntax check; the fetcher (proof-check.ts) blocks private and internal addresses at request time.
 */
export function parseProofLinks(raw: unknown): Parsed<string[]> {
  if (raw === undefined || raw === null) return { ok: true, value: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "proofLinks must be a list of links" };
  if (raw.length > MAX_PROOF_LINKS) return { ok: false, error: `at most ${MAX_PROOF_LINKS} proof links` };
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string" || v.length > 2048) return { ok: false, error: "each proof link must be a URL up to 2048 characters" };
    let u: URL;
    try {
      u = new URL(v.trim());
    } catch {
      return { ok: false, error: "a proof link is not a valid URL" };
    }
    if (u.protocol !== "https:") return { ok: false, error: "proof links must start with https://" };
    if (u.username || u.password) return { ok: false, error: "proof links must not contain credentials" };
    if (!out.includes(u.href)) out.push(u.href);
  }
  return { ok: true, value: out };
}

/** Whether the same work is registered elsewhere (prevents double claiming). */
export function parseRegistry(raw: unknown): Parsed<RegistryDeclaration | undefined> {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (typeof raw !== "object" || Array.isArray(raw)) return { ok: false, error: "registry must be an object" };
  const r = raw as Record<string, unknown>;
  if (typeof r.standard !== "string" || !(REGISTRY_STANDARDS as readonly string[]).includes(r.standard)) {
    return { ok: false, error: "registry.standard is not a supported value" };
  }
  const out: RegistryDeclaration = { standard: r.standard };
  if (r.serial !== undefined && r.serial !== "") {
    if (typeof r.serial !== "string" || !SERIAL.test(r.serial)) {
      return { ok: false, error: "registry.serial must be up to 100 letters, digits or . _ : / -" };
    }
    if (r.standard === "none") return { ok: false, error: "registry.serial needs a registry standard" };
    out.serial = r.serial;
  }
  return { ok: true, value: out };
}

const MANGROVE_FORMS = ["tree", "shrub"];

/**
 * v0.2 sanitiser for extractor output: unknown action keys are dropped (they would score 0 silently),
 * optional physical details are kept only when they are plausible numbers.
 */
export function sanitizeActionsV02(actions: unknown): ExtractedActionV02[] {
  if (!Array.isArray(actions)) return [];
  const out: ExtractedActionV02[] = [];
  for (const a of actions) {
    if (!isValidAction(a) || !Object.hasOwn(ACTION_WEIGHTS_V02, a.actionType)) continue;
    const src = a as unknown as Record<string, unknown>;
    const clean: ExtractedActionV02 = { actionType: a.actionType, quantity: a.quantity, unit: a.unit };
    const pos = (k: string, max: number) => {
      const v = src[k];
      return typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max ? v : undefined;
    };
    const areaHa = pos("areaHa", 1_000_000);
    const densityPerHa = pos("densityPerHa", 100_000);
    const years = pos("years", 100);
    const survivalRate = pos("survivalRate", 1);
    if (areaHa !== undefined) clean.areaHa = areaHa;
    if (densityPerHa !== undefined) clean.densityPerHa = densityPerHa;
    if (years !== undefined) clean.years = years;
    if (survivalRate !== undefined) clean.survivalRate = survivalRate;
    if (typeof src.mangroveForm === "string" && MANGROVE_FORMS.includes(src.mangroveForm)) {
      clean.mangroveForm = src.mangroveForm as "tree" | "shrub";
    }
    out.push(clean);
  }
  return out;
}

export interface ProcessOptions {
  /** Optional LLM extractor; falls back to deterministic rule-based extraction when absent. */
  extractor?: LLMExtractor;
  /** Methodology used to score new reports. Default v0.2; v0.1 stays for comparisons and old tests. */
  methodologyVersion?: MethodologyVersion;
}

/** Validate extractor output before it touches scoring or the DB (defense for LLM output). */
export function sanitizeActions(actions: unknown): ExtractedAction[] {
  if (!Array.isArray(actions)) return [];
  const out: ExtractedAction[] = [];
  for (const a of actions) {
    if (isValidAction(a)) {
      out.push({ actionType: a.actionType, quantity: a.quantity, unit: a.unit });
    }
  }
  return out;
}

function isValidAction(x: unknown): x is ExtractedAction {
  const a = x as Record<string, unknown> | null;
  return (
    !!a &&
    typeof a.actionType === "string" &&
    a.actionType.length > 0 &&
    a.actionType.length <= 60 &&
    typeof a.quantity === "number" &&
    Number.isFinite(a.quantity) &&
    a.quantity > 0 &&
    typeof a.unit === "string" &&
    a.unit.length <= 30
  );
}

function sameActions(a: ExtractedActionV02[], b: ExtractedActionV02[]): boolean {
  const key = (x: ExtractedActionV02[]) =>
    JSON.stringify(
      x
        .map((y) => [y.actionType, y.quantity, y.unit.toLowerCase(), y.areaHa ?? null, y.densityPerHa ?? null, y.survivalRate ?? null])
        .sort((p, q) => String(p[0]).localeCompare(String(q[0])) || Number(p[1]) - Number(q[1])),
    );
  return key(a) === key(b);
}

export async function processSubmission(db: DB, input: SubmissionInput, opts: ProcessOptions = {}) {
  const version = opts.methodologyVersion ?? "v0.2";
  const sanitize = version === "v0.2" ? sanitizeActionsV02 : sanitizeActions;
  let actions: ExtractedActionV02[];
  if (opts.extractor) {
    // LLM extraction, with a deterministic rule-based fallback on error or empty output.
    try {
      actions = sanitize(await opts.extractor.extract(input.description));
      if (actions.length === 0) actions = sanitize(ruleBasedExtract(input.description));
    } catch {
      actions = sanitize(ruleBasedExtract(input.description));
    }
  } else {
    actions = sanitize(ruleBasedExtract(input.description));
  }

  if (version === "v0.1") {
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
        methodologyVersion: "v0.1",
      })
      .returning();
    return { submission, iv };
  }

  const declared = sanitizeActionsV02(input.declaredActions);
  const aiActions = actions;
  const submitterEdited = declared.length > 0 && !sameActions(declared, aiActions);
  if (declared.length > 0) actions = declared;

  const ctx: ImpactContext & ImpactContextV02 & { aiActions?: ExtractedActionV02[]; submitterEdited?: boolean } = {
    ...(input.context ?? {}),
  };
  delete ctx.esm; // ESM comes from a validator, never from the submitter
  if (declared.length > 0) {
    ctx.aiActions = aiActions;
    ctx.submitterEdited = submitterEdited;
  }
  if (!ctx.ecosystem && input.location?.ecosystem) ctx.ecosystem = input.location.ecosystem;
  if (input.registry) ctx.registry = input.registry;
  const iv = computeImpactValueV02(actions, ctx);

  const [submission] = await db
    .insert(impactSubmissions)
    .values({
      orgId: input.orgId,
      title: input.title,
      description: input.description,
      domain: input.domain ?? iv.primaryDomain ?? undefined,
      status: "pending_verification",
      extractedActions: actions,
      context: ctx,
      ivResult: iv,
      ivValue: iv.impactValue.toFixed(4),
      tablesVersion: iv.tablesVersion,
      frameworkTags: iv.frameworkTags,
      mediaUris: input.mediaUris ?? [],
      chainId: input.chainId ?? null,
      methodologyVersion: iv.methodologyVersion,
      domainScores: iv.domainScores,
      location: input.location ?? null,
      proofLinks: input.proofLinks ?? [],
      registryDeclaration: input.registry ?? null,
      proofLevel: null, // set by a validator only
    })
    .returning();

  return { submission, iv };
}

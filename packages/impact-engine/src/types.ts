// Impact engine types. Pure, erasable TypeScript (runs under node --experimental-strip-types).

export type ImpactDomain =
  | "environment"
  | "animal_welfare"
  | "education"
  | "poverty"
  | "social"
  | "health";

/** A single structured action parsed from an NGO submission. */
export interface ExtractedAction {
  actionType: string; // canonical key into the action-weight table, e.g. "trees_planted"
  quantity: number;
  unit: string;
}

/** ACDM — Action Complexity & Difficulty answers (5 structured form questions). */
export interface ComplexityAnswers {
  technicalExpertise: "low" | "medium" | "high";
  resourceIntensity: "low" | "medium" | "high";
  projectScale: "local" | "city" | "regional";
  regulatory: "low" | "medium" | "high";
  environmentalConditions: "easy" | "moderate" | "challenging";
}

export type PopulationDensity = "low" | "medium" | "high" | "very_high";

/** Context shared across the actions of one submission. */
export interface ImpactContext {
  regionCode?: string; // for ESM (environmental sensitivity), rule-based by region in beta
  populationDensity?: PopulationDensity; // for PIM
  complexity?: ComplexityAnswers; // for ACDM
  periodStart?: string; // ISO date
  periodEnd?: string; // ISO date
}

/** Per-action factor breakdown — the audit trail. */
export interface ActionBreakdown {
  actionType: string;
  quantity: number;
  aw: number;
  sm: number;
  tbv: number;
  esm: number;
  pim: number;
  acdm: number;
  raw: number; // aw * quantity * sm * tbv * esm * pim * acdm
  clampedQuantity: boolean;
}

export interface FrameworkTags {
  sdg: string[]; // e.g. ["SDG-13", "SDG-15"]
  ebf: string[]; // Ecological Benefits Framework (environment only): air|water|soil|biodiversity|equity|carbon
}

/** Deterministic, auditable result of impact scoring. */
export interface IVResult {
  impactValue: number;
  tablesVersion: string;
  breakdown: ActionBreakdown[];
  frameworkTags: FrameworkTags;
  capped: boolean; // true if any quantity was clamped (anti-gaming)
}

/** An entry in the action-weight reference table. */
export interface ActionWeight {
  aw: number;
  domain: ImpactDomain;
  unit: string;
  sdg: string[];
  ebf?: string[]; // only for environment domain
}

export type ActionWeightTable = Record<string, ActionWeight>;

// Impact Value v0.2 types ("Community layer"). v0.1 types in types.ts stay unchanged so old scores
// keep recomputing with their own tables.

import type { ImpactDomain } from "./types.ts";

/** Where a number comes from: a cited table, our arithmetic on a cited table, or a stated assumption. */
export type SourceStatus = "sourced" | "derived" | "assumption";

export interface SourcedValue {
  value: number;
  status: SourceStatus;
  source: string; // short citation; the full reasoning is in docs/methodology/cards/<action>.md
  needsCheck?: boolean; // value is provisional until the cost survey (D6) or the expert round
}

/** A parsed action. v0.2 adds optional physical details the NGO can declare. */
export interface ExtractedActionV02 {
  actionType: string;
  quantity: number;
  unit: string;
  areaHa?: number; // planted / restored area for tree and mangrove rows
  densityPerHa?: number; // declared planting density, used when only a tree count is given
  years?: number; // monitored years credited (carbon actions), default 1, max 20
  survivalRate?: number; // measured share that survived, 0..1 (mangroves, coral, trees)
  mangroveForm?: "tree" | "shrub";
}

export type Ecosystem = "mangrove" | "forest" | "coral_reef" | "seagrass" | "grassland" | "urban" | "coast" | "other";

export interface RegistryDeclaration {
  standard: string; // "none" | "verra" | "gold_standard" | "plan_vivo" | "hypercerts" | other
  serial?: string; // registry serial number of retired / issued units
}

/** Context of one report. No field gives a bonus by default: an empty context scores with factor 1.0. */
export interface ImpactContextV02 {
  country?: string; // ISO 3166-1 alpha-2, for grid factors
  ecosystem?: Ecosystem;
  esm?: number; // environmental sensitivity confirmed by a validator, clamped to 1.0..1.3
  adjacentToHabitat?: boolean; // site connects to existing habitat: no small-patch discount
  registry?: RegistryDeclaration;
  periodStart?: string; // kept as data (duplicate checks); does not change the score
  periodEnd?: string;
}

export type FlagCode =
  | "unknown_action"
  | "unit_mismatch"
  | "needs_area"
  | "needs_country"
  | "double_count"
  | "registry_required"
  | "multi_year_claim"
  | "survival_not_measured"
  | "input_not_outcome"
  | "gate_iucn"
  | "review_overlap"
  | "clamped"
  | "invalid_quantity"
  | "out_of_scope";

export interface ScoreFlag {
  code: FlagCode;
  actionType?: string;
  detail: string;
}

export interface ActionBreakdownV02 {
  actionType: string;
  domain: ImpactDomain;
  lines: number; // how many input lines were merged into this row
  quantity: number; // merged quantity in the action's input unit
  inputUnit: string;
  units: number; // physical units after conversion (ha·yr, kg, person-days, tCO2e, people...)
  scoredUnit: string;
  aw: number;
  awStatus: SourceStatus;
  awSource: string;
  sm: number;
  esm: number;
  s: number;
  raw: number; // units * aw * sm * esm * s
  physical?: { amount: number; unit: string }; // e.g. tCO2e/yr for carbon rows
}

export interface DomainScoreV02 {
  domain: ImpactDomain;
  score: number; // Σ raw for the domain
  k: number; // published domain coefficient
  weighted: number; // score * k, the domain's share of IV
  physical: { amount: number; unit: string }[];
}

export interface IVResultV02 {
  methodologyVersion: string;
  tablesVersion: string;
  impactValue: number; // Σ domain score × k
  domainScores: DomainScoreV02[];
  primaryDomain: ImpactDomain | null;
  breakdown: ActionBreakdownV02[];
  frameworkTags: { sdg: string[]; ebf: string[]; iris: string[] };
  flags: ScoreFlag[];
  capped: boolean;
}

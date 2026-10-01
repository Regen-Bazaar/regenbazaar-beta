// Impact Value v0.2 reference tables ("Community layer").
//
// Every number carries a status: "sourced" (a cited table), "derived" (our arithmetic on a cited table)
// or "assumption" (platform judgement, needs checking). The reasoning for each action is in
// docs/methodology/cards/<action>.md. v0.1 tables (tables.ts) stay unchanged for old scores.
//
// Environment scores are in tCO2e-equivalent points (1 point = 1 tCO2e, same anchor as v0.1
// co2_offset_ton = 1.0). Other domains keep v0.1 per-unit weights until the
// expert round; the domain coefficients k connect them into one IV.

import type { ImpactDomain } from "./types.ts";
import type { SourcedValue } from "./types-v02.ts";

export const METHODOLOGY_VERSION_V02 = "v0.2";
export const TABLES_VERSION_V02 = "v0.2-community-2026-09";

/** Anti-gaming: one merged action's quantity (input unit) is clamped to this before scoring. */
export const MAX_ACTION_QUANTITY_V02 = 1_000_000;
/** Carbon rows credit at most this many monitored years (Bernal 2018 rate is for years 0 to 20). */
export const MAX_CREDITED_YEARS = 20;

const A = (value: number, source: string): SourcedValue => ({ value, status: "assumption", source, needsCheck: true });
const S = (value: number, source: string): SourcedValue => ({ value, status: "sourced", source });
const D = (value: number, source: string, needsCheck = false): SourcedValue => ({
  value,
  status: "derived",
  source,
  ...(needsCheck ? { needsCheck } : {}),
});

/** How an action's input quantity becomes physical units. */
export type Conversion =
  | "none" // units = quantity
  | "trees_to_ha" // count → ha via declared area or density → ha·yr
  | "ha_year" // ha → ha·yr
  | "liters_to_person_days"
  | "kwh_to_tco2e"
  | "m2"; // classroom space; a count of schools needs an area

export interface ActionWeightV02 {
  domain: ImpactDomain;
  inputUnit: string; // canonical unit the extractor must return (after units.ts normalisation)
  scoredUnit: string; // physical unit the weight applies to
  conversion: Conversion;
  aw: SourcedValue; // points per scored unit
  s?: SourcedValue; // survival / permanence discount, default 1.0
  areaFactor?: boolean; // SM (area-scale factor) applies
  carbon?: boolean; // scored units are tCO2e/yr-bearing (shown as physical tCO2e)
  sdg: string[];
  ebf?: string[];
  iris?: string[]; // IRIS+ metric IDs used as the unit definition (cited with attribution)
  parked?: string; // not a community action (needs capital, a licence or professionals): kept, scores 0
}

// ---- Environment anchors ----

/** Bernal, Murray, Pearson 2018, Carbon Balance Manag., Table 2, planted tropical mangroves, years 0–20. */
export const MANGROVE_RATE_TREE = S(23.1, "Bernal et al. 2018, Table 2 (tree form, yrs 0–20, above-ground)");
export const MANGROVE_RATE_SHRUB = S(6.7, "Bernal et al. 2018, Table 2 (shrub form)");
/** IPCC 2019 Refinement V4 Ch4 Table 4.10 (Asia tropical rainforest, other, 5 t d.m./ha/yr) × 0.47 × 44/12. */
export const FOREST_RATE_TROPICAL_ASIA = D(
  8.6,
  "IPCC 2019 Refinement V4 Table 4.10 × 0.47 (2006 GL Table 4.3) × 44/12",
  true,
);

export const ACTION_WEIGHTS_V02: Record<string, ActionWeightV02> = {
  // environment
  trees_planted: {
    domain: "environment", inputUnit: "trees", scoredUnit: "ha·yr", conversion: "trees_to_ha",
    aw: FOREST_RATE_TROPICAL_ASIA, areaFactor: true, carbon: true,
    sdg: ["SDG-13", "SDG-15"], ebf: ["carbon", "biodiversity"],
  },
  mangroves_planted: {
    domain: "environment", inputUnit: "trees", scoredUnit: "ha·yr", conversion: "trees_to_ha",
    aw: MANGROVE_RATE_TREE,
    s: A(0.72, "proxy: Bourgeois et al. 2024, planted stands reach 71–73% of intact biomass; replaced by measured survival"),
    areaFactor: true, carbon: true,
    sdg: ["SDG-13", "SDG-14", "SDG-15"], ebf: ["carbon", "biodiversity", "water"],
  },
  coral_planted: {
    domain: "environment", inputUnit: "fragments", scoredUnit: "fragments", conversion: "none",
    aw: A(0.4, "v0.1 value; no carbon or value source for coral fragments"),
    s: S(0.65, "Boström-Einarsson et al. 2020, PLoS ONE: 60–70% survival (midpoint)"),
    sdg: ["SDG-14"], ebf: ["biodiversity", "water"],
  },
  waste_collected_kg: {
    domain: "environment", inputUnit: "kg", scoredUnit: "kg", conversion: "none",
    aw: A(0.05, "v0.1 value; unit per Verra Plastic / OBP / BVRio definitions, value needs check"),
    sdg: ["SDG-12", "SDG-14"], ebf: ["soil", "water"],
  },
  plastic_recycled_kg: {
    domain: "environment", inputUnit: "kg", scoredUnit: "kg", conversion: "none",
    aw: D(0.00105, "EPA WARM v16 Exhibit 5-3, mixed plastics recycling vs landfill, per metric t (US factors)"),
    sdg: ["SDG-12"], ebf: ["soil", "water"],
  },
  co2_offset_ton: {
    domain: "environment", inputUnit: "tCO2e", scoredUnit: "tCO2e", conversion: "none",
    aw: S(1.0, "anchor: 1 point = 1 tCO2e; only with a registry serial"), carbon: true,
    parked: "registry carbon belongs to the corporate layer",
    sdg: ["SDG-13"], ebf: ["carbon"],
  },
  hectares_restored: {
    domain: "environment", inputUnit: "ha", scoredUnit: "ha·yr", conversion: "ha_year",
    aw: FOREST_RATE_TROPICAL_ASIA, areaFactor: true, carbon: true,
    sdg: ["SDG-15"], ebf: ["biodiversity", "soil"],
  },
  water_purified_liters: {
    domain: "environment", inputUnit: "liters", scoredUnit: "person-days", conversion: "liters_to_person_days",
    aw: A(0.0055, "v0.1 scale (0.001/L × 5.5 L); needs check"),
    parked: "treatment systems need capital investment",
    sdg: ["SDG-6"], ebf: ["water"], iris: ["PI2822"],
  },
  renewable_energy_kwh: {
    domain: "environment", inputUnit: "kWh", scoredUnit: "tCO2e", conversion: "kwh_to_tco2e",
    aw: S(1.0, "anchor: 1 point = 1 tCO2e avoided"), carbon: true,
    parked: "installations need capital investment",
    sdg: ["SDG-7", "SDG-13"], ebf: ["carbon", "air"],
  },
  // animal welfare: no published relative weights exist (audit 3.5); definitions per WOAH Ch. 7.7 / ICAM
  animals_rescued: { domain: "animal_welfare", inputUnit: "animals", scoredUnit: "animals", conversion: "none", aw: A(0.5, "v0.1 value"), sdg: ["SDG-15"] },
  animals_sterilized: { domain: "animal_welfare", inputUnit: "animals", scoredUnit: "animals", conversion: "none", aw: A(0.3, "v0.1 value; WOAH 7.7.18"), sdg: ["SDG-15"] },
  animals_treated: { domain: "animal_welfare", inputUnit: "animals", scoredUnit: "animals", conversion: "none", aw: A(0.2, "v0.1 value; ICAM welfare indicators"), sdg: ["SDG-15"] },
  animals_adopted: { domain: "animal_welfare", inputUnit: "animals", scoredUnit: "animals", conversion: "none", aw: A(0.6, "v0.1 value; WOAH 7.7.20"), sdg: ["SDG-15"] },
  wildlife_released: { domain: "animal_welfare", inputUnit: "animals", scoredUnit: "animals", conversion: "none", aw: A(0.8, "v0.1 value; IUCN/SSC 2013 gate"), sdg: ["SDG-15"] },
  // education
  students_taught: { domain: "education", inputUnit: "students", scoredUnit: "students", conversion: "none", aw: A(0.2, "v0.1 value"), sdg: ["SDG-4"], iris: ["PI2389"] },
  workshops_held: { domain: "education", inputUnit: "workshops", scoredUnit: "workshops", conversion: "none", aw: A(0.05, "v0.1 value; 0 when participants are counted"), sdg: ["SDG-4"] },
  scholarships_granted: { domain: "education", inputUnit: "scholarships", scoredUnit: "scholarships", conversion: "none", aw: A(1.0, "v0.1 value"), parked: "a funded programme, not volunteer work", sdg: ["SDG-4"], iris: ["PI4509", "PI3499"] },
  teachers_trained: { domain: "education", inputUnit: "teachers", scoredUnit: "teachers", conversion: "none", aw: A(0.5, "v0.1 value"), sdg: ["SDG-4"], iris: ["PI2998", "PI1902"] },
  books_distributed: { domain: "education", inputUnit: "books", scoredUnit: "books", conversion: "none", aw: A(0.02, "v0.1 value"), sdg: ["SDG-4"], iris: ["PI5736"] },
  schools_built: {
    domain: "education", inputUnit: "m2", scoredUnit: "m²", conversion: "m2",
    aw: A(0.1, "v0.1 value 50 per school ÷ assumed 500 m² of classroom space"),
    parked: "construction needs capital investment",
    sdg: ["SDG-4", "SDG-9"], iris: ["PI7268"],
  },
  // poverty
  meals_provided: { domain: "poverty", inputUnit: "meals", scoredUnit: "meals", conversion: "none", aw: A(0.02, "v0.1 value"), sdg: ["SDG-1", "SDG-2"], iris: ["PI6971"] },
  people_housed: { domain: "poverty", inputUnit: "people", scoredUnit: "people", conversion: "none", aw: A(1.0, "v0.1 value"), parked: "housing needs capital investment", sdg: ["SDG-1"], iris: ["PI2491", "PI5965"] },
  microloans_issued: { domain: "poverty", inputUnit: "loans", scoredUnit: "loans", conversion: "none", aw: A(0.5, "v0.1 value"), parked: "a regulated financial service", sdg: ["SDG-1", "SDG-8"], iris: ["PI8381"] },
  jobs_created: { domain: "poverty", inputUnit: "jobs", scoredUnit: "FTE", conversion: "none", aw: A(1.5, "v0.1 value; full-time equivalents"), parked: "employment needs a funded enterprise", sdg: ["SDG-1", "SDG-8"], iris: ["PI3687", "PI9465"] },
  families_supported: { domain: "poverty", inputUnit: "families", scoredUnit: "families", conversion: "none", aw: A(0.4, "v0.1 value"), sdg: ["SDG-1"], iris: ["PI7954", "PI1583"] },
  clean_water_access_people: { domain: "poverty", inputUnit: "people", scoredUnit: "people", conversion: "none", aw: A(0.3, "v0.1 value; JMP safely managed"), parked: "infrastructure needs capital investment", sdg: ["SDG-6", "SDG-1"], iris: ["PI2822"] },
  // social
  people_trained: { domain: "social", inputUnit: "people", scoredUnit: "people", conversion: "none", aw: A(0.1, "v0.1 value"), sdg: ["SDG-8"], iris: ["PI2998"] },
  volunteers_mobilized: { domain: "social", inputUnit: "volunteers", scoredUnit: "volunteers", conversion: "none", aw: S(0, "input, not outcome (IRIS+ OI1166); shown as context"), sdg: ["SDG-17"], iris: ["OI1166"] },
  women_empowered: { domain: "social", inputUnit: "women", scoredUnit: "women", conversion: "none", aw: A(0.3, "v0.1 value; too vague, to be split"), sdg: ["SDG-5", "SDG-8"], iris: ["PI8330"] },
  community_events_held: { domain: "social", inputUnit: "events", scoredUnit: "events", conversion: "none", aw: A(0.1, "v0.1 value"), sdg: ["SDG-11"] },
  // health
  patients_treated: { domain: "health", inputUnit: "patients", scoredUnit: "patients", conversion: "none", aw: A(0.2, "v0.1 value"), parked: "needs licensed medical professionals", sdg: ["SDG-3"], iris: ["PI5060"] },
  vaccinations_administered: { domain: "health", inputUnit: "vaccinations", scoredUnit: "vaccinations", conversion: "none", aw: A(0.05, "v0.1 value; likely underweighted"), parked: "needs licensed medical professionals", sdg: ["SDG-3"] },
  medical_kits_distributed: { domain: "health", inputUnit: "kits", scoredUnit: "kits", conversion: "none", aw: A(0.1, "v0.1 value"), sdg: ["SDG-3"] },
  mental_health_sessions: { domain: "health", inputUnit: "sessions", scoredUnit: "sessions", conversion: "none", aw: A(0.15, "v0.1 value"), parked: "needs licensed professionals", sdg: ["SDG-3"] },
};

/** Actions a community group can deliver without capital, a licence or professionals (the Community layer). */
export function isCommunityAction(actionType: string): boolean {
  const w = ACTION_WEIGHTS_V02[actionType];
  return !!w && !w.parked;
}

/** k: published domain coefficients that turn domain scores into one IV. All 1.0: categories are not compared at this stage. */
export const DOMAIN_K: Record<ImpactDomain, SourcedValue> = {
  environment: A(1.0, "categories are not compared at this stage"),
  animal_welfare: A(1.0, "categories are not compared at this stage"),
  education: A(1.0, "categories are not compared at this stage"),
  poverty: A(1.0, "categories are not compared at this stage"),
  social: A(1.0, "categories are not compared at this stage"),
  health: A(1.0, "categories are not compared at this stage"),
};

/** SM v0.2: area-scale factor for area-based ecosystem actions, on the report's total area of one action. */
export const AREA_FACTOR_TIERS: { minHa: number; factor: SourcedValue }[] = [
  { minHa: 1, factor: A(1.0, "no discount from 1 ha") },
  { minHa: 0.5, factor: A(0.9, "small patch; direction per Haddad et al. 2015, threshold needs check") },
  { minHa: 0, factor: A(0.75, "very small isolated patch; Haddad et al. 2015 (fragmentation −13…75%), threshold needs check") },
];
export function areaFactor(totalHa: number, adjacentToHabitat = false): number {
  if (adjacentToHabitat) return 1.0;
  for (const t of AREA_FACTOR_TIERS) if (totalHa >= t.minHa) return t.factor.value;
  return 1.0;
}

/** ESM v0.2: environment only, 1.0..1.3, suggested from open data layers and confirmed by a validator. */
export const ESM_MIN = 1.0;
export const ESM_MAX = 1.3;
export function clampEsm(esm: unknown): number {
  if (typeof esm !== "number" || !Number.isFinite(esm)) return 1.0;
  return Math.min(Math.max(esm, ESM_MIN), ESM_MAX);
}

/**
 * IFI Default Grid Factors v3.0 (Dec 2021), combined margin for intermittent sources, tCO2e per kWh.
 * Unknown country: the lowest listed factor (conservative), flagged for the validator.
 */
export const GRID_FACTORS: Record<string, SourcedValue> = {
  TH: S(0.000413, "IFI v3.0, Thailand"),
  VN: S(0.000493, "IFI v3.0, Viet Nam"),
  ID: S(0.000714, "IFI v3.0, Indonesia"),
  PH: S(0.000617, "IFI v3.0, Philippines"),
  MY: S(0.000508, "IFI v3.0, Malaysia"),
  KH: S(0.000874, "IFI v3.0, Cambodia"),
  LA: S(0.000876, "IFI v3.0, Lao PDR"),
  IN: S(0.000842, "IFI v3.0, India"),
};
export const GRID_FACTOR_FALLBACK = 0.000413;

/** Gold Standard Safe Drinking Water Supply v2.0 (July 2026): adult cap 5.5 L/person/day, 5% deduction on defaults. */
export const WATER_LITERS_PER_PERSON_DAY = S(5.5, "Gold Standard SWS v2.0, adult cap");
export const WATER_DEFAULT_DEDUCTION = S(0.95, "Gold Standard SWS v2.0, 5% deduction when defaults are used");

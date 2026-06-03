// Versioned reference tables for the Impact Value engine.
//
// ⚠️ v0 SEED VALUES — placeholder weights/multipliers spanning the FULL impact spectrum
// (environment + animal welfare + education + poverty + social/health). NOT third-party certified.
// These must be co-developed/calibrated with domain experts and a published methodology before
// any "certified" claim. Tables are versioned so historical IV scores stay auditable.

import type {
  ActionWeightTable,
  ComplexityAnswers,
  PopulationDensity,
} from "./types.ts";

export const TABLES_VERSION = "v0.1-seed-2026-06";

/** Anti-gaming: a single action's quantity is clamped to this before scoring. */
export const MAX_ACTION_QUANTITY = 1_000_000;

export const ACTION_WEIGHTS: ActionWeightTable = {
  // environment
  trees_planted: { aw: 0.1, domain: "environment", unit: "trees", sdg: ["SDG-13", "SDG-15"], ebf: ["carbon", "biodiversity"] },
  mangroves_planted: { aw: 0.15, domain: "environment", unit: "trees", sdg: ["SDG-13", "SDG-14", "SDG-15"], ebf: ["carbon", "biodiversity", "water"] },
  coral_planted: { aw: 0.4, domain: "environment", unit: "fragments", sdg: ["SDG-14"], ebf: ["biodiversity", "water"] },
  waste_collected_kg: { aw: 0.05, domain: "environment", unit: "kg", sdg: ["SDG-12", "SDG-14"], ebf: ["soil", "water"] },
  plastic_recycled_kg: { aw: 0.06, domain: "environment", unit: "kg", sdg: ["SDG-12"], ebf: ["soil", "water"] },
  co2_offset_ton: { aw: 1.0, domain: "environment", unit: "tCO2e", sdg: ["SDG-13"], ebf: ["carbon"] },
  hectares_restored: { aw: 2.0, domain: "environment", unit: "ha", sdg: ["SDG-15"], ebf: ["biodiversity", "soil"] },
  water_purified_liters: { aw: 0.001, domain: "environment", unit: "liters", sdg: ["SDG-6"], ebf: ["water"] },
  renewable_energy_kwh: { aw: 0.002, domain: "environment", unit: "kWh", sdg: ["SDG-7", "SDG-13"], ebf: ["carbon", "air"] },
  // animal welfare
  animals_rescued: { aw: 0.5, domain: "animal_welfare", unit: "animals", sdg: ["SDG-15"] },
  animals_sterilized: { aw: 0.3, domain: "animal_welfare", unit: "animals", sdg: ["SDG-15"] },
  animals_treated: { aw: 0.2, domain: "animal_welfare", unit: "animals", sdg: ["SDG-15"] },
  animals_adopted: { aw: 0.6, domain: "animal_welfare", unit: "animals", sdg: ["SDG-15"] },
  wildlife_released: { aw: 0.8, domain: "animal_welfare", unit: "animals", sdg: ["SDG-15"] },
  // education
  students_taught: { aw: 0.2, domain: "education", unit: "students", sdg: ["SDG-4"] },
  workshops_held: { aw: 0.05, domain: "education", unit: "workshops", sdg: ["SDG-4"] },
  scholarships_granted: { aw: 1.0, domain: "education", unit: "scholarships", sdg: ["SDG-4"] },
  teachers_trained: { aw: 0.5, domain: "education", unit: "teachers", sdg: ["SDG-4"] },
  books_distributed: { aw: 0.02, domain: "education", unit: "books", sdg: ["SDG-4"] },
  schools_built: { aw: 50.0, domain: "education", unit: "schools", sdg: ["SDG-4", "SDG-9"] },
  // poverty
  meals_provided: { aw: 0.02, domain: "poverty", unit: "meals", sdg: ["SDG-1", "SDG-2"] },
  people_housed: { aw: 1.0, domain: "poverty", unit: "people", sdg: ["SDG-1"] },
  microloans_issued: { aw: 0.5, domain: "poverty", unit: "loans", sdg: ["SDG-1", "SDG-8"] },
  jobs_created: { aw: 1.5, domain: "poverty", unit: "jobs", sdg: ["SDG-1", "SDG-8"] },
  families_supported: { aw: 0.4, domain: "poverty", unit: "families", sdg: ["SDG-1"] },
  clean_water_access_people: { aw: 0.3, domain: "poverty", unit: "people", sdg: ["SDG-6", "SDG-1"] },
  // social
  people_trained: { aw: 0.1, domain: "social", unit: "people", sdg: ["SDG-8"] },
  volunteers_mobilized: { aw: 0.05, domain: "social", unit: "volunteers", sdg: ["SDG-17"] },
  women_empowered: { aw: 0.3, domain: "social", unit: "women", sdg: ["SDG-5", "SDG-8"] },
  community_events_held: { aw: 0.1, domain: "social", unit: "events", sdg: ["SDG-11"] },
  // health
  patients_treated: { aw: 0.2, domain: "health", unit: "patients", sdg: ["SDG-3"] },
  vaccinations_administered: { aw: 0.05, domain: "health", unit: "vaccinations", sdg: ["SDG-3"] },
  medical_kits_distributed: { aw: 0.1, domain: "health", unit: "kits", sdg: ["SDG-3"] },
  mental_health_sessions: { aw: 0.15, domain: "health", unit: "sessions", sdg: ["SDG-3"] },
};

/** SM — Scope Multiplier tiers (first tier whose `min` the quantity reaches, highest first). */
export const SCOPE_TIERS: { min: number; multiplier: number }[] = [
  { min: 1001, multiplier: 2.0 },
  { min: 500, multiplier: 1.5 },
  { min: 100, multiplier: 1.2 },
  { min: 0, multiplier: 1.0 },
];
export function scopeMultiplier(quantity: number): number {
  for (const t of SCOPE_TIERS) if (quantity >= t.min) return t.multiplier;
  return 1.0;
}

/** TBV — Time-Based Value from a period (years). 1 + 0.1*years, capped at 2.0. */
export function timeBasedValue(periodStart?: string, periodEnd?: string): number {
  if (!periodStart || !periodEnd) return 1.0;
  const start = Date.parse(periodStart);
  const end = Date.parse(periodEnd);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 1.0;
  const years = (end - start) / (365 * 24 * 3600 * 1000);
  return Math.min(1.0 + 0.1 * years, 2.0);
}

/** ESM — Environmental Sensitivity Multiplier by region (environment domain only). */
export const ESM_BY_REGION: Record<string, number> = {
  amazon: 1.5,
  congo_basin: 1.5,
  coral_reef: 1.5,
  southeast_asia: 1.3,
  protected_area: 1.5,
  temperate: 1.0,
  urban: 1.0,
};
export function environmentalSensitivity(regionCode?: string): number {
  if (!regionCode) return 1.0;
  return ESM_BY_REGION[regionCode] ?? 1.0;
}

/** PIM — Population Impact Multiplier by density. */
export const PIM_BY_DENSITY: Record<PopulationDensity, number> = {
  low: 1.0,
  medium: 1.2,
  high: 1.5,
  very_high: 1.8,
};
export function populationImpact(density?: PopulationDensity): number {
  if (!density) return 1.0;
  return PIM_BY_DENSITY[density] ?? 1.0;
}

/** ACDM — Action Complexity & Difficulty per-answer scales (averaged across the 5 questions). */
export const ACDM_SCALES = {
  technicalExpertise: { low: 1.0, medium: 1.2, high: 1.5 },
  resourceIntensity: { low: 1.0, medium: 1.3, high: 1.5 },
  projectScale: { local: 1.0, city: 1.2, regional: 1.4 },
  regulatory: { low: 1.0, medium: 1.2, high: 1.3 },
  environmentalConditions: { easy: 1.0, moderate: 1.1, challenging: 1.3 },
} as const;

/** ACDM — Action Complexity & Difficulty Multiplier = average of the 5 scored answers. */
export function actionComplexity(c?: ComplexityAnswers): number {
  if (!c) return 1.0;
  const s = ACDM_SCALES;
  return (
    (s.technicalExpertise[c.technicalExpertise] +
      s.resourceIntensity[c.resourceIntensity] +
      s.projectScale[c.projectScale] +
      s.regulatory[c.regulatory] +
      s.environmentalConditions[c.environmentalConditions]) /
    5
  );
}

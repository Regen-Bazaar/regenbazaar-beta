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

export const TABLES_VERSION = "v0-seed-2026-06";

/** Anti-gaming: a single action's quantity is clamped to this before scoring. */
export const MAX_ACTION_QUANTITY = 1_000_000;

export const ACTION_WEIGHTS: ActionWeightTable = {
  // environment
  trees_planted: { aw: 0.1, domain: "environment", unit: "trees", sdg: ["SDG-13", "SDG-15"], ebf: ["carbon", "biodiversity"] },
  waste_collected_kg: { aw: 0.05, domain: "environment", unit: "kg", sdg: ["SDG-12", "SDG-14"], ebf: ["soil", "water"] },
  co2_offset_ton: { aw: 1.0, domain: "environment", unit: "tCO2e", sdg: ["SDG-13"], ebf: ["carbon"] },
  hectares_restored: { aw: 2.0, domain: "environment", unit: "ha", sdg: ["SDG-15"], ebf: ["biodiversity", "soil"] },
  // animal welfare
  animals_rescued: { aw: 0.5, domain: "animal_welfare", unit: "animals", sdg: ["SDG-15"] },
  animals_sterilized: { aw: 0.3, domain: "animal_welfare", unit: "animals", sdg: ["SDG-15"] },
  animals_treated: { aw: 0.2, domain: "animal_welfare", unit: "animals", sdg: ["SDG-15"] },
  // education
  students_taught: { aw: 0.2, domain: "education", unit: "students", sdg: ["SDG-4"] },
  workshops_held: { aw: 0.05, domain: "education", unit: "workshops", sdg: ["SDG-4"] },
  scholarships_granted: { aw: 1.0, domain: "education", unit: "scholarships", sdg: ["SDG-4"] },
  // poverty
  meals_provided: { aw: 0.02, domain: "poverty", unit: "meals", sdg: ["SDG-1", "SDG-2"] },
  people_housed: { aw: 1.0, domain: "poverty", unit: "people", sdg: ["SDG-1"] },
  microloans_issued: { aw: 0.5, domain: "poverty", unit: "loans", sdg: ["SDG-1", "SDG-8"] },
  // social / health
  patients_treated: { aw: 0.2, domain: "health", unit: "patients", sdg: ["SDG-3"] },
  people_trained: { aw: 0.1, domain: "social", unit: "people", sdg: ["SDG-8"] },
};

/** SM — Scope Multiplier by quantity. */
export function scopeMultiplier(quantity: number): number {
  if (quantity > 1000) return 2.0;
  if (quantity >= 500) return 1.5;
  if (quantity >= 100) return 1.2;
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
const ESM_BY_REGION: Record<string, number> = {
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
const PIM_BY_DENSITY: Record<PopulationDensity, number> = {
  low: 1.0,
  medium: 1.2,
  high: 1.5,
  very_high: 1.8,
};
export function populationImpact(density?: PopulationDensity): number {
  if (!density) return 1.0;
  return PIM_BY_DENSITY[density] ?? 1.0;
}

/** ACDM — Action Complexity & Difficulty Multiplier = average of the 5 scored answers. */
export function actionComplexity(c?: ComplexityAnswers): number {
  if (!c) return 1.0;
  const tech = { low: 1.0, medium: 1.2, high: 1.5 }[c.technicalExpertise];
  const res = { low: 1.0, medium: 1.3, high: 1.5 }[c.resourceIntensity];
  const scale = { local: 1.0, city: 1.2, regional: 1.4 }[c.projectScale];
  const reg = { low: 1.0, medium: 1.2, high: 1.3 }[c.regulatory];
  const env = { easy: 1.0, moderate: 1.1, challenging: 1.3 }[c.environmentalConditions];
  return (tech + res + scale + reg + env) / 5;
}

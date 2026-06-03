// Seed the versioned action-weight reference table (v0 placeholder, mirrors @rb/impact-engine tables).
// These tables are the off-chain, admin-editable, versioned source the IV engine reads. v0 values are
// NOT third-party certified — calibrate with domain experts + a published methodology before mainnet.

import type { DB } from "./client.ts";
import { actionWeights } from "./schema.ts";

export const SEED_VERSION = "v0-seed-2026-06";

const ROWS = [
  { actionType: "trees_planted", aw: "0.1000", domain: "environment", unit: "trees", sdg: ["SDG-13", "SDG-15"], ebf: ["carbon", "biodiversity"] },
  { actionType: "co2_offset_ton", aw: "1.0000", domain: "environment", unit: "tCO2e", sdg: ["SDG-13"], ebf: ["carbon"] },
  { actionType: "animals_rescued", aw: "0.5000", domain: "animal_welfare", unit: "animals", sdg: ["SDG-15"], ebf: null },
  { actionType: "students_taught", aw: "0.2000", domain: "education", unit: "students", sdg: ["SDG-4"], ebf: null },
  { actionType: "meals_provided", aw: "0.0200", domain: "poverty", unit: "meals", sdg: ["SDG-1", "SDG-2"], ebf: null },
  { actionType: "patients_treated", aw: "0.2000", domain: "health", unit: "patients", sdg: ["SDG-3"], ebf: null },
] as const;

export async function seedActionWeights(db: DB): Promise<void> {
  await db
    .insert(actionWeights)
    .values(ROWS.map((r) => ({ version: SEED_VERSION, active: true, ...r })))
    .onConflictDoNothing();
}

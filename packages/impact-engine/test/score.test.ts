import { test } from "node:test";
import assert from "node:assert/strict";
import { computeImpactValue } from "../src/score.ts";
import { TABLES_VERSION } from "../src/tables.ts";
import type { ComplexityAnswers } from "../src/types.ts";

test("environment: trees in a sensitive region", () => {
  const r = computeImpactValue([{ actionType: "trees_planted", quantity: 1000, unit: "trees" }], {
    regionCode: "amazon",
  });
  // 0.1 aw * 1000 * 1.5 sm(>=500) * 1 tbv * 1.5 esm(amazon) * 1 pim * 1 acdm = 225
  assert.equal(r.impactValue, 225);
  assert.deepEqual(r.frameworkTags.sdg, ["SDG-13", "SDG-15"]);
  assert.deepEqual(r.frameworkTags.ebf, ["biodiversity", "carbon"]);
  assert.equal(r.tablesVersion, TABLES_VERSION);
  assert.equal(r.capped, false);
});

test("deterministic: same inputs => identical result", () => {
  const input = [{ actionType: "trees_planted", quantity: 320, unit: "trees" }];
  const a = computeImpactValue(input, { regionCode: "southeast_asia" });
  const b = computeImpactValue(input, { regionCode: "southeast_asia" });
  assert.deepEqual(a, b);
});

test("anti-gaming: quantity is clamped and flagged", () => {
  const r = computeImpactValue([{ actionType: "trees_planted", quantity: 5_000_000, unit: "trees" }]);
  // clamped to 1_000_000 -> 0.1 * 1e6 * 2.0 sm(>1000) = 200000
  assert.equal(r.impactValue, 200000);
  assert.equal(r.capped, true);
  assert.equal(r.breakdown[0].clampedQuantity, true);
});

test("broad spectrum: non-environment action has no EBF tags", () => {
  const r = computeImpactValue([{ actionType: "students_taught", quantity: 200, unit: "students" }]);
  // 0.2 * 200 * 1.2 sm(>=100) = 48
  assert.equal(r.impactValue, 48);
  assert.deepEqual(r.frameworkTags.sdg, ["SDG-4"]);
  assert.deepEqual(r.frameworkTags.ebf, []);
});

test("unknown action types contribute zero", () => {
  const r = computeImpactValue([{ actionType: "moon_landings", quantity: 100, unit: "x" }]);
  assert.equal(r.impactValue, 0);
  assert.equal(r.breakdown.length, 0);
});

test("multipliers: density, complexity and period apply", () => {
  const complexity: ComplexityAnswers = {
    technicalExpertise: "high", // 1.5
    resourceIntensity: "high", // 1.5
    projectScale: "regional", // 1.4
    regulatory: "high", // 1.3
    environmentalConditions: "challenging", // 1.3
  };
  const r = computeImpactValue([{ actionType: "students_taught", quantity: 50, unit: "students" }], {
    populationDensity: "high", // 1.5
    complexity, // avg = 1.4
    periodStart: "2023-01-01",
    periodEnd: "2024-01-01", // 1 year -> tbv 1.1
  });
  // 0.2 * 50 * 1.0 sm(<100) * 1.1 tbv * 1 esm(non-env) * 1.5 pim * 1.4 acdm = 23.1
  assert.equal(r.impactValue, 23.1);
  assert.equal(r.breakdown[0].acdm, 1.4);
});

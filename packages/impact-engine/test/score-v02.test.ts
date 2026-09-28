import { test } from "node:test";
import assert from "node:assert/strict";
import { computeImpactValueV02 } from "../src/score-v02.ts";
import { scoreImpact } from "../src/scoring.ts";
import { computeImpactValue } from "../src/score.ts";
import { ACTION_WEIGHTS_V02, DOMAIN_K, TABLES_VERSION_V02, areaFactor } from "../src/tables-v02.ts";
import { ACTION_WEIGHTS } from "../src/tables.ts";
import { normaliseQuantity } from "../src/units.ts";
import type { ComplexityAnswers } from "../src/types.ts";

const codes = (r: { flags: { code: string }[] }) => r.flags.map((f) => f.code);

test("1200 kg in one line scores the same as two lines of 600", () => {
  const one = computeImpactValueV02([{ actionType: "waste_collected_kg", quantity: 1200, unit: "kg" }]);
  const two = computeImpactValueV02([
    { actionType: "waste_collected_kg", quantity: 600, unit: "kg" },
    { actionType: "waste_collected_kg", quantity: 600, unit: "kg" },
  ]);
  assert.equal(one.impactValue, 60); // 1200 × 0.05
  assert.equal(two.impactValue, one.impactValue);
  assert.equal(two.breakdown.length, 1);
  assert.equal(two.breakdown[0].lines, 2);
});

test("splitting an area action into lines cannot lift the area factor", () => {
  const whole = computeImpactValueV02([{ actionType: "hectares_restored", quantity: 1.2, unit: "ha" }]);
  const parts = computeImpactValueV02([
    { actionType: "hectares_restored", quantity: 0.4, unit: "ha" },
    { actionType: "hectares_restored", quantity: 0.4, unit: "ha" },
    { actionType: "hectares_restored", quantity: 0.4, unit: "ha" },
  ]);
  assert.equal(parts.impactValue, whole.impactValue);
  assert.equal(parts.breakdown[0].sm, 1.0);
});

test("form defaults give no bonus: complexity, density and period do not change v0.2 IV", () => {
  const actions = [
    { actionType: "waste_collected_kg", quantity: 380, unit: "kg" },
    { actionType: "students_taught", quantity: 30, unit: "students" },
  ];
  const demoDefaults: ComplexityAnswers = {
    technicalExpertise: "medium",
    resourceIntensity: "medium",
    projectScale: "city",
    regulatory: "medium",
    environmentalConditions: "moderate",
  };
  const bare = scoreImpact(actions, {}, "v0.2");
  const withDefaults = scoreImpact(
    actions,
    { regionCode: "southeast_asia", populationDensity: "high", complexity: demoDefaults, periodStart: "2025-01-01", periodEnd: "2026-01-01" },
    "v0.2",
  );
  assert.deepEqual(withDefaults, bare);
  assert.equal(bare.result.impactValue, 380 * 0.05 + 30 * 0.2);
});

test("scoreImpact v0.1 path is identical to computeImpactValue", () => {
  const actions = [{ actionType: "trees_planted", quantity: 1000, unit: "trees" }];
  const r = scoreImpact(actions, { regionCode: "amazon" }, "v0.1");
  assert.equal(r.version, "v0.1");
  assert.deepEqual(r.result, computeImpactValue(actions, { regionCode: "amazon" }));
});

test("default version is v0.2", () => {
  const r = scoreImpact([{ actionType: "students_taught", quantity: 10, unit: "students" }]);
  assert.equal(r.version, "v0.2");
  assert.equal(r.version === "v0.2" && r.result.tablesVersion, TABLES_VERSION_V02);
});

test("mangroves: trees → ha by density → tCO2e/yr, with ESM and default survival", () => {
  const r = computeImpactValueV02(
    [{ actionType: "mangroves_planted", quantity: 3000, unit: "trees", densityPerHa: 2500 }],
    { esm: 1.3 },
  );
  const b = r.breakdown[0];
  assert.equal(b.units, 1.2); // 3000 / 2500 ha × 1 yr
  assert.equal(b.aw, 23.1);
  assert.equal(b.sm, 1.0);
  assert.equal(b.esm, 1.3);
  assert.equal(b.s, 0.72);
  assert.equal(r.impactValue, Math.round(1.2 * 23.1 * 0.72 * 1.3 * 1e4) / 1e4);
  assert.deepEqual(b.physical, { amount: Math.round(1.2 * 23.1 * 0.72 * 1e4) / 1e4, unit: "tCO2e/yr" });
  assert.ok(codes(r).includes("survival_not_measured"));
  assert.equal(r.primaryDomain, "environment");
});

test("mangroves: measured survival replaces the default; shrub form uses 6.7", () => {
  const r = computeImpactValueV02([
    { actionType: "mangroves_planted", quantity: 3000, unit: "trees", areaHa: 1.5, survivalRate: 0.8, mangroveForm: "shrub" },
  ]);
  const b = r.breakdown[0];
  assert.equal(b.s, 0.8);
  assert.equal(b.aw, 6.7);
  assert.equal(r.impactValue, Math.round(1.5 * 6.7 * 0.8 * 1e4) / 1e4);
  assert.ok(!codes(r).includes("survival_not_measured"));
});

test("tree count without area or density scores 0 and asks for area", () => {
  const r = computeImpactValueV02([{ actionType: "trees_planted", quantity: 1000, unit: "trees" }]);
  assert.equal(r.impactValue, 0);
  assert.ok(codes(r).includes("needs_area"));
});

test("wording gap closed: '3000 mangroves on 1.5 ha' = '1.5 ha of mangroves restored'", () => {
  const asTrees = computeImpactValueV02([{ actionType: "mangroves_planted", quantity: 3000, unit: "trees", areaHa: 1.5 }]);
  const asArea = computeImpactValueV02([{ actionType: "hectares_restored", quantity: 1.5, unit: "ha" }], { ecosystem: "mangrove" });
  assert.equal(asArea.impactValue, asTrees.impactValue);
});

test("SM area factor: small isolated patches are discounted, adjacency removes it", () => {
  assert.equal(areaFactor(0.2), 0.75);
  assert.equal(areaFactor(0.6), 0.9);
  assert.equal(areaFactor(1), 1.0);
  assert.equal(areaFactor(0.2, true), 1.0);
  const small = computeImpactValueV02([{ actionType: "hectares_restored", quantity: 0.2, unit: "ha" }]);
  assert.equal(small.breakdown[0].sm, 0.75);
  const joined = computeImpactValueV02([{ actionType: "hectares_restored", quantity: 0.2, unit: "ha" }], { adjacentToHabitat: true });
  assert.equal(joined.breakdown[0].sm, 1.0);
});

test("SM is 1.0 outside area-based ecosystem actions", () => {
  const r = computeImpactValueV02([{ actionType: "students_taught", quantity: 5000, unit: "students" }]);
  assert.equal(r.breakdown[0].sm, 1.0);
  assert.equal(r.impactValue, 1000);
});

test("units: tonnes become kg; 1 t of waste scores as 1000 kg", () => {
  const t = computeImpactValueV02([{ actionType: "waste_collected_kg", quantity: 1, unit: "tonnes" }]);
  const kg = computeImpactValueV02([{ actionType: "waste_collected_kg", quantity: 1000, unit: "kg" }]);
  assert.equal(t.impactValue, kg.impactValue);
  assert.equal(normaliseQuantity(2, "rai", "ha"), 0.32);
  assert.equal(normaliseQuantity(5000, "m2", "ha"), 0.5);
  assert.equal(normaliseQuantity(3, "dogs", "animals"), 3);
});

test("units: an impossible unit scores 0 and is flagged", () => {
  const r = computeImpactValueV02([{ actionType: "waste_collected_kg", quantity: 20, unit: "bags" }]);
  assert.equal(r.impactValue, 0);
  assert.ok(codes(r).includes("unit_mismatch"));
});

test("schools are scored by classroom space; a bare school count asks for m²", () => {
  const count = computeImpactValueV02([{ actionType: "schools_built", quantity: 2, unit: "schools" }]);
  assert.equal(count.impactValue, 0);
  assert.ok(codes(count).includes("needs_area"));
  const area = computeImpactValueV02([{ actionType: "schools_built", quantity: 400, unit: "m2" }]);
  assert.equal(area.impactValue, 40);
});

test("water: litres → person-days with the Gold Standard adult cap and 5% default deduction", () => {
  const r = computeImpactValueV02([{ actionType: "water_purified_liters", quantity: 55_000, unit: "liters" }]);
  assert.equal(r.breakdown[0].units, 9500); // 55000 / 5.5 × 0.95
  assert.equal(r.impactValue, Math.round(9500 * 0.0055 * 1e4) / 1e4);
});

test("renewable energy: country grid factor; unknown country uses the lowest factor and is flagged", () => {
  const th = computeImpactValueV02([{ actionType: "renewable_energy_kwh", quantity: 10_000, unit: "kWh" }], { country: "TH" });
  assert.equal(th.impactValue, 4.13);
  const vn = computeImpactValueV02([{ actionType: "renewable_energy_kwh", quantity: 10, unit: "MWh" }], { country: "vn" });
  assert.equal(vn.impactValue, 4.93);
  const xx = computeImpactValueV02([{ actionType: "renewable_energy_kwh", quantity: 10_000, unit: "kWh" }]);
  assert.equal(xx.impactValue, 4.13);
  assert.ok(codes(xx).includes("needs_country"));
});

test("coral: survival 0.65 from Boström-Einarsson 2020", () => {
  const r = computeImpactValueV02([{ actionType: "coral_planted", quantity: 100, unit: "fragments" }]);
  assert.equal(r.impactValue, 26); // 100 × 0.4 × 0.65
});

test("double count: area row wins over the tree count of the same planting", () => {
  const r = computeImpactValueV02([
    { actionType: "mangroves_planted", quantity: 3000, unit: "trees", areaHa: 1.5 },
    { actionType: "hectares_restored", quantity: 1.5, unit: "ha" },
  ]);
  const trees = r.breakdown.find((b) => b.actionType === "mangroves_planted")!;
  const area = r.breakdown.find((b) => b.actionType === "hectares_restored")!;
  assert.equal(trees.raw, 0);
  assert.equal(area.aw, 23.1); // mangrove site → mangrove rate
  assert.ok(codes(r).includes("double_count"));
  const alone = computeImpactValueV02([{ actionType: "mangroves_planted", quantity: 3000, unit: "trees", areaHa: 1.5 }]);
  assert.equal(r.impactValue, alone.impactValue);
});

test("double count: tCO2e needs a registry serial; with one, tree carbon becomes evidence", () => {
  const noSerial = computeImpactValueV02([{ actionType: "co2_offset_ton", quantity: 50, unit: "tCO2e" }]);
  assert.equal(noSerial.impactValue, 0);
  assert.ok(codes(noSerial).includes("registry_required"));
  const serial = computeImpactValueV02(
    [
      { actionType: "co2_offset_ton", quantity: 50, unit: "tCO2e" },
      { actionType: "trees_planted", quantity: 1000, unit: "trees", areaHa: 1 },
    ],
    { registry: { standard: "verra", serial: "VCS-123" } },
  );
  assert.equal(serial.impactValue, 50);
  assert.ok(codes(serial).includes("double_count"));
});

test("double count: recycled plastic adds only carbon when collection is also reported", () => {
  const both = computeImpactValueV02([
    { actionType: "waste_collected_kg", quantity: 1000, unit: "kg" },
    { actionType: "plastic_recycled_kg", quantity: 400, unit: "kg" },
  ]);
  assert.equal(both.impactValue, Math.round((1000 * 0.05 + 400 * 0.00105) * 1e4) / 1e4);
  const alone = computeImpactValueV02([{ actionType: "plastic_recycled_kg", quantity: 400, unit: "kg" }]);
  assert.equal(alone.impactValue, Math.round(400 * (0.05 + 0.00105) * 1e4) / 1e4);
});

test("double count: workshops score 0 when participants are counted; volunteers are context only", () => {
  const r = computeImpactValueV02([
    { actionType: "workshops_held", quantity: 10, unit: "workshops" },
    { actionType: "students_taught", quantity: 30, unit: "students" },
    { actionType: "volunteers_mobilized", quantity: 50, unit: "volunteers" },
  ]);
  assert.equal(r.impactValue, 6);
  assert.ok(codes(r).includes("double_count"));
  assert.ok(codes(r).includes("input_not_outcome"));
});

test("double count: meals and family support for the same families keep the higher one", () => {
  const r = computeImpactValueV02([
    { actionType: "meals_provided", quantity: 1000, unit: "meals" }, // 20
    { actionType: "families_supported", quantity: 10, unit: "families" }, // 4
  ]);
  assert.equal(r.impactValue, 20);
});

test("overlap and gate flags do not change the score", () => {
  const r = computeImpactValueV02([
    { actionType: "patients_treated", quantity: 10, unit: "patients" },
    { actionType: "vaccinations_administered", quantity: 10, unit: "vaccinations" },
    { actionType: "wildlife_released", quantity: 2, unit: "animals" },
  ]);
  assert.equal(r.impactValue, 2 + 0.5 + 1.6);
  assert.ok(codes(r).includes("review_overlap"));
  assert.ok(codes(r).includes("gate_iucn"));
});

test("ESM is clamped to 1.0–1.3 and applies to environment only", () => {
  const hi = computeImpactValueV02([{ actionType: "waste_collected_kg", quantity: 100, unit: "kg" }], { esm: 5 });
  assert.equal(hi.breakdown[0].esm, 1.3);
  const lo = computeImpactValueV02([{ actionType: "waste_collected_kg", quantity: 100, unit: "kg" }], { esm: 0.1 });
  assert.equal(lo.breakdown[0].esm, 1.0);
  const edu = computeImpactValueV02([{ actionType: "students_taught", quantity: 10, unit: "students" }], { esm: 1.3 });
  assert.equal(edu.breakdown[0].esm, 1.0);
});

test("carbon years: default 1, capped at 20, >1 flagged for the validator", () => {
  const r = computeImpactValueV02([{ actionType: "hectares_restored", quantity: 1, unit: "ha", years: 50 }]);
  assert.equal(r.breakdown[0].units, 20);
  assert.ok(codes(r).includes("multi_year_claim"));
});

test("invalid input: NaN, negative, non-array and unknown actions score 0 without throwing", () => {
  const r = computeImpactValueV02([
    { actionType: "waste_collected_kg", quantity: NaN, unit: "kg" },
    { actionType: "waste_collected_kg", quantity: -5, unit: "kg" },
    { actionType: "moon_landings", quantity: 3, unit: "x" },
    null as never,
  ]);
  assert.equal(r.impactValue, 0);
  assert.equal(r.primaryDomain, null);
  assert.ok(codes(r).includes("invalid_quantity"));
  assert.ok(codes(r).includes("unknown_action"));
  assert.equal(computeImpactValueV02("nope" as never).impactValue, 0);
});

test("anti-gaming clamp applies to the merged quantity, not per line", () => {
  const r = computeImpactValueV02([
    { actionType: "waste_collected_kg", quantity: 1_000_000, unit: "kg" },
    { actionType: "waste_collected_kg", quantity: 1_000_000, unit: "kg" },
    { actionType: "waste_collected_kg", quantity: 1_000_000, unit: "kg" },
  ]);
  assert.equal(r.impactValue, 50_000);
  assert.equal(r.capped, true);
});

test("IV = Σ domain score × k; domain scores and physical units are reported", () => {
  const r = computeImpactValueV02([
    { actionType: "waste_collected_kg", quantity: 380, unit: "kg" },
    { actionType: "students_taught", quantity: 30, unit: "students" },
  ]);
  const env = r.domainScores.find((d) => d.domain === "environment")!;
  const edu = r.domainScores.find((d) => d.domain === "education")!;
  assert.equal(env.score, 19);
  assert.deepEqual(env.physical, [{ amount: 380, unit: "kg" }]);
  assert.equal(edu.score, 6);
  assert.equal(r.impactValue, env.score * DOMAIN_K.environment.value + edu.score * DOMAIN_K.education.value);
  assert.deepEqual(r.frameworkTags.iris, ["PI2389"]);
});

test("deterministic: same inputs give identical results", () => {
  const a = [{ actionType: "mangroves_planted", quantity: 2000, unit: "trees", areaHa: 0.8 }];
  assert.deepEqual(computeImpactValueV02(a, { esm: 1.2 }), computeImpactValueV02(a, { esm: 1.2 }));
});

test("table: same 34 actions as v0.1, every weight has a status and a source", () => {
  assert.deepEqual(Object.keys(ACTION_WEIGHTS_V02).sort(), Object.keys(ACTION_WEIGHTS).sort());
  assert.equal(Object.keys(ACTION_WEIGHTS_V02).length, 34);
  for (const [k, w] of Object.entries(ACTION_WEIGHTS_V02)) {
    assert.ok(["sourced", "derived", "assumption"].includes(w.aw.status), k);
    assert.ok(w.aw.source.length > 0, k);
    if (w.s) assert.ok(w.s.source.length > 0, k);
  }
});

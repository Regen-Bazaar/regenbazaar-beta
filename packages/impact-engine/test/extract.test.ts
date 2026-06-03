import { test } from "node:test";
import assert from "node:assert/strict";
import { ruleBasedExtract } from "../src/extract.ts";
import { computeImpactValue } from "../src/score.ts";

function byType(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of ruleBasedExtract(text)) out[a.actionType] = a.quantity;
  return out;
}

test("extracts across the impact spectrum", () => {
  const text =
    "30 dogs rescued. 12 cats sterilized. 1000 trees planted. 5 workshops held. 1,500 meals provided. 200 students taught.";
  const got = byType(text);
  assert.equal(got.animals_rescued, 30);
  assert.equal(got.animals_sterilized, 12);
  assert.equal(got.trees_planted, 1000);
  assert.equal(got.workshops_held, 5);
  assert.equal(got.meals_provided, 1500);
  assert.equal(got.students_taught, 200);
});

test("handles thousands separators", () => {
  const got = byType("We provided 12,000 meals.");
  assert.equal(got.meals_provided, 12000);
});

test("end-to-end: extract then score is deterministic and non-zero", () => {
  const actions = ruleBasedExtract("1000 trees planted and 5 workshops held");
  const r = computeImpactValue(actions, { regionCode: "temperate" });
  assert.ok(r.impactValue > 0);
  // trees: 0.1*1000*1.5 = 150 ; workshops: 0.05*5*1.0 = 0.25 -> 150.25
  assert.equal(r.impactValue, 150.25);
});

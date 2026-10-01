import { test } from "node:test";
import assert from "node:assert/strict";
import { computePriceV02, effortFactor, PRICE_MODEL_VERSION_V02 } from "../src/price-v02.ts";
import { FX_USD } from "../src/cost-v02.ts";

FX_USD.XTS = { value: 0.03, status: "sourced", source: "test" }; // ISO test currency

test("IV sets the price: IV × rate × P, split across editions (no cost → E = 1)", () => {
  const p = computePriceV02(28.8, "P3", undefined, 100)!;
  assert.equal(p.totalUsd, 25.92); // 28.8 × $1 × 0.9
  assert.equal(p.perEditionUsd, 0.2592);
  assert.equal(p.e, 1);
  assert.equal(p.modelVersion, PRICE_MODEL_VERSION_V02);
});

test("declared cost raises the price by at most 50%, never adds dollars", () => {
  assert.equal(effortFactor(0, 100), 1);
  assert.equal(effortFactor(50, 100), 1.25);
  assert.equal(effortFactor(100, 100), 1.5);
  assert.equal(effortFactor(1_000_000, 100), 1.5);
  // cleanup example: IV 19, P2, cost ≈ $278 → 19 × 0.8 × 1.5 = 22.8
  const big = { currency: "USD", volunteerHours: 0, hourlyValue: 0, spent: { materials: 278.31 } };
  assert.equal(computePriceV02(19, "P2", big)!.totalUsd, 22.8);
  // a small cost relative to the impact adds a little: IV 100, cost $20 → E = 1.1
  const small = { currency: "XTS", volunteerHours: 0, hourlyValue: 0, spent: { food: 666.6667 } };
  assert.equal(computePriceV02(100, "P4", small)!.e, 1.1);
});

test("more impact, higher price, at the same cost", () => {
  const cost = { currency: "USD", volunteerHours: 10, hourlyValue: 2, spent: {} };
  assert.ok(computePriceV02(40, "P2", cost)!.totalUsd > computePriceV02(20, "P2", cost)!.totalUsd);
});

test("proof level: P0 or none is not priced; unknown currency counts as no cost", () => {
  assert.equal(computePriceV02(100, "P0"), null);
  assert.equal(computePriceV02(100, null), null);
  assert.equal(computePriceV02(100, "P1")!.totalUsd, 60);
  assert.equal(computePriceV02(100, "P2", { currency: "ABC", volunteerHours: 5, hourlyValue: 5, spent: {} })!.e, 1);
});

test("invalid IV and editions are safe", () => {
  assert.equal(computePriceV02(NaN, "P2", undefined, 100)!.totalUsd, 0);
  assert.equal(computePriceV02(-5, "P2")!.totalUsd, 0);
  assert.equal(computePriceV02(10, "P4", undefined, 0)!.editions, 1);
});

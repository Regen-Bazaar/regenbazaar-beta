import { test } from "node:test";
import assert from "node:assert/strict";
import { computePriceV02, complexityFactor, PRICE_RATE_USD_PER_IV, PRICE_MODEL_VERSION_V02 } from "../src/price-v02.ts";

test("price USD = IV × rate × P × C, split across editions", () => {
  const p = computePriceV02(28.8, "P3", undefined, 100)!;
  assert.equal(p.totalUsd, Math.round(28.8 * PRICE_RATE_USD_PER_IV.value * 0.9 * 1e4) / 1e4);
  assert.equal(p.perEditionUsd, Math.round((p.totalUsd / 100) * 1e4) / 1e4);
  assert.equal(p.c, 1);
  assert.equal(p.modelVersion, PRICE_MODEL_VERSION_V02);
});

test("complexity raises the price, not the impact (C from 1.0 to 1.4)", () => {
  const hard = { technicalExpertise: "high", resourceIntensity: "high", projectScale: "regional", regulatory: "high", environmentalConditions: "challenging" } as const;
  assert.equal(complexityFactor(hard), 1.4);
  assert.equal(complexityFactor(undefined), 1);
  const easy = computePriceV02(100, "P4", undefined)!;
  const harder = computePriceV02(100, "P4", hard)!;
  assert.equal(harder.totalUsd, 140);
  assert.equal(easy.totalUsd, 100);
});

test("proof level: P0 or none is not priced; higher proof, higher price", () => {
  assert.equal(computePriceV02(100, "P0"), null);
  assert.equal(computePriceV02(100, null), null);
  assert.equal(computePriceV02(100, "P1")!.totalUsd, 60);
  assert.equal(computePriceV02(100, "P2")!.totalUsd, 80);
});

test("invalid IV and editions are safe", () => {
  assert.equal(computePriceV02(NaN, "P2", undefined, 100)!.totalUsd, 0);
  assert.equal(computePriceV02(-5, "P2")!.totalUsd, 0);
  assert.equal(computePriceV02(10, "P4", undefined, 0)!.editions, 1);
});

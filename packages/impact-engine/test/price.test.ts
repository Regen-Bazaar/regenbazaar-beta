import { test } from "node:test";
import assert from "node:assert/strict";
import { computePrice, PRICE_RATE_PER_IV, PRICE_MODEL_VERSION } from "../src/price.ts";

test("price is derived from Impact Value (IV x rate), split across editions", () => {
  const p = computePrice(515.2583, 100);
  assert.equal(p.totalPrice, 257.6292); // 515.2583 * 0.5, rounded to 4dp
  assert.equal(p.pricePerEdition, 2.5763); // 257.6292 / 100
  assert.equal(p.rate, PRICE_RATE_PER_IV);
  assert.equal(p.editions, 100);
  assert.equal(p.modelVersion, PRICE_MODEL_VERSION);
});

test("editions defaults to 1 (per-edition == total)", () => {
  const p = computePrice(100);
  assert.equal(p.totalPrice, 50);
  assert.equal(p.pricePerEdition, 50);
});

test("zero / invalid IV yields zero price", () => {
  assert.equal(computePrice(0, 10).totalPrice, 0);
  assert.equal(computePrice(-5, 10).totalPrice, 0);
});

test("more editions -> lower per-edition price, same total", () => {
  const a = computePrice(1000, 10);
  const b = computePrice(1000, 100);
  assert.equal(a.totalPrice, b.totalPrice);
  assert.ok(b.pricePerEdition < a.pricePerEdition);
});

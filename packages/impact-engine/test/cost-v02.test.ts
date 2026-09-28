import { test } from "node:test";
import assert from "node:assert/strict";
import { FX_USD, MIN_WAGE_REFERENCE, costToUsd, labourCheck, priceFromCost } from "../src/cost-v02.ts";

// Test-only entries (ISO 4217 "XTS" is reserved for testing; "ZZ" is not a country).
FX_USD.XTS = { value: 0.03, status: "sourced", source: "test" };
MIN_WAGE_REFERENCE.ZZ = { hourly: 50, currency: "XTS", basis: "test", source: "test", effective: "2026-01-01" };

const decl = { currency: "XTS", volunteerHours: 40, hourlyValue: 60, spent: { materials: 1000, transport: 500, food: 300 } };

test("cost in USD = (hours × hourly value + money spent) × FX", () => {
  const c = costToUsd(decl)!;
  assert.equal(c.labourUsd, 72); // 40 × 60 × 0.03
  assert.equal(c.spentUsd, 54); // 1800 × 0.03
  assert.equal(c.totalUsd, 126);
});

test("price = cost × P, split across editions; impact does not enter", () => {
  const p = priceFromCost(decl, "P2", 100)!;
  assert.equal(p.totalUsd, 100.8); // 126 × 0.8
  assert.equal(p.perEditionUsd, 1.008);
  assert.equal(priceFromCost(decl, "P4", 100)!.totalUsd, 126);
});

test("not priced without a listable proof level or a known currency", () => {
  assert.equal(priceFromCost(decl, "P0"), null);
  assert.equal(priceFromCost(decl, null), null);
  assert.equal(priceFromCost({ ...decl, currency: "ABC" }, "P2"), null);
});

test("negative, NaN and absurd amounts are ignored or bounded", () => {
  const c = costToUsd({ currency: "XTS", volunteerHours: -5, hourlyValue: NaN, spent: { materials: -1, other: 1e12 } })!;
  assert.equal(c.labourUsd, 0);
  assert.equal(c.spentUsd, 300000); // bounded at 10,000,000 × 0.03
});

test("labour check compares the declared hourly value with the country's minimum wage (information only)", () => {
  assert.equal(labourCheck(decl, "ZZ").ratio, 1.2);
  assert.equal(labourCheck(decl, "ZZ").note, "within the usual range");
  assert.match(labourCheck({ ...decl, hourlyValue: 400 }, "ZZ").note, /well above/);
  assert.match(labourCheck({ ...decl, hourlyValue: 20 }, "ZZ").note, /below/);
  assert.equal(labourCheck(decl, "QQ").reference, null);
  // different currencies are compared through USD
  const usd = labourCheck({ currency: "USD", volunteerHours: 1, hourlyValue: 3, spent: {} }, "ZZ");
  assert.equal(usd.ratio, 2); // minimum 50 XTS = 1.5 USD
});

test("real tables: every minimum wage currency has an FX rate; the example form case", () => {
  for (const [cc, ref] of Object.entries(MIN_WAGE_REFERENCE)) {
    if (cc === "ZZ") continue;
    assert.ok(FX_USD[ref.currency], `${cc} ${ref.currency}`);
    assert.ok(ref.source && ref.effective, cc);
  }
  const example = { currency: "THB", volunteerHours: 60, hourlyValue: 60, spent: { materials: 3000, transport: 1500, food: 1200 } };
  assert.equal(labourCheck(example, "TH").ratio, 1.42); // 60 ÷ 42.13
  assert.equal(Math.round(costToUsd(example)!.totalUsd), Math.round((3600 + 5700) / 33.4161));
});

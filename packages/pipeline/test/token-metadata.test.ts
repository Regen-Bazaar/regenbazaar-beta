import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTokenMetadata, type TokenMetadataInput } from "../src/token-metadata.ts";

const input: TokenMetadataInput = {
  title: "Beach reforestation & cleanup — Koh Phangan",
  domain: "environment",
  actions: [
    { actionType: "trees_planted", quantity: 1000, unit: "trees" },
    { actionType: "waste_collected_kg", quantity: 1500, unit: "kg" },
  ],
  frameworks: { sdg: ["SDG-13", "SDG-15"], ebf: ["carbon", "biodiversity"] },
  impactValue: 292.5,
  editions: 100,
  regionCode: "southeast_asia",
  periodStart: "2024-01-01",
  periodEnd: "2025-01-01",
  tablesVersion: "v0.1-seed-2026-06",
  easUID: "0xabc",
  externalUrl: "https://app.regenbazaar.com/submission/x",
};

test("embeds the impact data directly in the token metadata (self-describing)", () => {
  const m = buildTokenMetadata(input);
  assert.equal(m.name, input.title);
  assert.match(m.description, /1,000 trees planted/);
  assert.match(m.description, /1,500 waste collected kg/);
  const traits = m.attributes.map((a) => a.trait_type);
  for (const t of ["Impact domain", "trees planted", "Impact Value", "Editions", "Region (approximate)", "SDG", "EBF", "Methodology"]) {
    assert.ok(traits.includes(t), `missing attribute ${t}`);
  }
  assert.equal(m.properties.actions.length, 2);
  assert.equal(m.properties.impactValue, 292.5);
  assert.equal(m.properties.thirdPartyCertified, false);
  assert.equal(m.properties.region, "southeast asia");
});

test("only allowlisted top-level fields are published (no raw report / geo / media / wallet leakage)", () => {
  const m = buildTokenMetadata(input);
  assert.deepEqual(
    Object.keys(m).sort(),
    ["attributes", "description", "external_url", "image", "name", "properties"],
  );
  const blob = JSON.stringify(m).toLowerCase();
  // the builder has no parameter for the raw report, precise geo, media or wallet — they cannot appear.
  assert.ok(!blob.includes("media_uris"));
  assert.ok(!blob.includes("wallet"));
  assert.ok(!blob.includes("validator"));
});

test("approximate region only; missing image falls back to a mint-time placeholder", () => {
  const m = buildTokenMetadata({ ...input, imageUri: null, regionCode: null, periodStart: null, periodEnd: null });
  assert.equal(m.image, "ipfs://__set_at_mint__");
  assert.ok(!m.attributes.some((a) => a.trait_type === "Region (approximate)"));
  assert.equal(m.properties.region, undefined);
});

test("v0.2 metadata: schema trwi-2, domain scores with physical units, proof level, IRIS+ IDs", () => {
  const m = buildTokenMetadata({
    ...input,
    methodologyVersion: "v0.2",
    tablesVersion: "v0.2-community-2026-09",
    domainScores: [
      { domain: "environment", score: 28.8, k: 1, weighted: 28.8, physical: [{ amount: 1.2, unit: "ha" }, { amount: 27.72, unit: "tCO2e/yr" }] },
      { domain: "education", score: 6, k: 1, weighted: 6, physical: [{ amount: 30, unit: "students" }] },
    ],
    proofLevel: "P3",
    iris: ["PI2389"],
  });
  assert.equal(m.properties.schema, "regen-bazaar/trwi-2");
  assert.equal(m.properties.methodologyVersion, "v0.2");
  assert.equal(m.properties.proofLevel, "P3");
  assert.deepEqual(m.properties.iris, ["PI2389"]);
  assert.equal(m.properties.domainScores?.[0].score, 28.8);
  const traits = Object.fromEntries(m.attributes.map((a) => [a.trait_type, a.value]));
  assert.equal(traits["Domain score: environment"], 28.8);
  assert.equal(traits["environment (tCO2e/yr)"], 27.72);
  assert.equal(traits["Proof level"], "P3");
  assert.equal(traits["Methodology"], "v0.2 Community layer (v0.2-community-2026-09)");
  assert.match(m.description, /own relative index/);
  assert.doesNotMatch(m.description, /offset|certified/i);
});

test("v0.1 metadata keeps schema trwi-1 even if v0.2 fields are passed without the version", () => {
  const m = buildTokenMetadata({ ...input, proofLevel: "P2" });
  assert.equal(m.properties.schema, "regen-bazaar/trwi-1");
  assert.equal(m.properties.proofLevel, undefined);
});

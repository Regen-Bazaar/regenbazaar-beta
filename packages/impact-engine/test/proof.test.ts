import { test } from "node:test";
import assert from "node:assert/strict";
import { PROOF_FACTORS, isListable, parseProofLevel, proofFactor } from "../src/proof.ts";

test("proof factors are the pilot hypothesis 0 / 0.6 / 0.8 / 0.9 / 1.0", () => {
  assert.deepEqual(PROOF_FACTORS, { P0: 0, P1: 0.6, P2: 0.8, P3: 0.9, P4: 1.0 });
  assert.equal(proofFactor("P3"), 0.9);
});

test("P0 is not listable; P1 and above are", () => {
  assert.equal(isListable("P0"), false);
  assert.equal(isListable(null), false);
  assert.equal(isListable("P1"), true);
  assert.equal(isListable("P4"), true);
});

test("parseProofLevel rejects anything outside P0–P4", () => {
  assert.equal(parseProofLevel("P2"), "P2");
  assert.equal(parseProofLevel("p2"), null);
  assert.equal(parseProofLevel("P5"), null);
  assert.equal(parseProofLevel(2), null);
  assert.equal(parseProofLevel(undefined), null);
});

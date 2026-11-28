import { test } from "node:test";
import assert from "node:assert/strict";
import { areaScores, buyerPoints, emptyAreaPoints, holdingPoints, pointsPerEdition, UNGRADED_PROOF_FACTOR, type PointsImpact } from "../src/points.ts";

const BUYER = "0x00000000000000000000000000000000000000b1";
const CREATOR = "0x00000000000000000000000000000000000000c1";

function impact(over: Partial<PointsImpact> = {}): PointsImpact {
  return {
    methodologyVersion: "v0.2",
    domain: "environment",
    ivValue: 30,
    domainScores: [{ domain: "environment", score: 30 }],
    proofLevel: "P2",
    maxEditions: 100,
    withdrawn: false,
    creatorWallets: [CREATOR],
    ...over,
  };
}

test("the document's example: score 30 at proof level 2 gives 0.24 per edition and 24 for all 100", () => {
  assert.equal(pointsPerEdition(impact()).environment, 0.24);
  assert.equal(buyerPoints(BUYER, [{ editionsHeld: 100, editionsRetired: 0, impact: impact() }]).environment, 24);
});

test("an impact with scores in two areas gives points in both, never added together", () => {
  const two = impact({ domainScores: [{ domain: "environment", score: 50.65 }, { domain: "education", score: 6 }] });
  const p = buyerPoints(BUYER, [{ editionsHeld: 10, editionsRetired: 0, impact: two }]);
  assert.equal(p.environment, 4.052); // 50.65 / 100 * 0.8 * 10
  assert.equal(p.education, 0.48);
  assert.equal(p.social, 0);
});

test("a v0.1 impact counts its total in the area it is filed under, with the ungraded factor", () => {
  const old = impact({ methodologyVersion: null, domain: "animal_welfare", ivValue: 98.49, domainScores: null, proofLevel: null });
  assert.deepEqual(areaScores(old), { animal_welfare: 98.49 });
  assert.equal(UNGRADED_PROOF_FACTOR, 0.6);
  assert.equal(buyerPoints(BUYER, [{ editionsHeld: 2, editionsRetired: 0, impact: old }]).animal_welfare, 1.18188);
});

test("a v0.1 impact filed under no area gives nothing", () => {
  const old = impact({ methodologyVersion: null, domain: null, ivValue: 73.8, domainScores: null, proofLevel: null });
  assert.deepEqual(buyerPoints(BUYER, [{ editionsHeld: 5, editionsRetired: 0, impact: old }]), emptyAreaPoints());
});

test("retired editions keep their points: held and retired count the same", () => {
  const held = buyerPoints(BUYER, [{ editionsHeld: 3, editionsRetired: 0, impact: impact() }]);
  const retired = buyerPoints(BUYER, [{ editionsHeld: 1, editionsRetired: 2, impact: impact() }]);
  assert.deepEqual(held, retired);
  assert.equal(held.environment, 0.72);
});

test("a withdrawn impact gives zero", () => {
  assert.deepEqual(buyerPoints(BUYER, [{ editionsHeld: 10, editionsRetired: 5, impact: impact({ withdrawn: true }) }]), emptyAreaPoints());
});

test("a creator buying their own tRWI earns no buyer points (any letter case)", () => {
  const h = { editionsHeld: 10, editionsRetired: 0, impact: impact() };
  assert.deepEqual(holdingPoints(CREATOR.toUpperCase().replace("0X", "0x"), h), emptyAreaPoints());
  assert.equal(holdingPoints(BUYER, h).environment, 2.4);
});

test("stronger proof counts more: 0.6, 0.8, 0.9, 1.0", () => {
  const per = (proofLevel: string) => pointsPerEdition(impact({ proofLevel })).environment;
  assert.deepEqual([per("P1"), per("P2"), per("P3"), per("P4")], [0.18, 0.24, 0.27, 0.3]);
});

test("bad input gives zero, never NaN: no editions, unknown area, ungraded v0.2, negative counts", () => {
  assert.deepEqual(pointsPerEdition(impact({ maxEditions: 0 })), emptyAreaPoints());
  assert.deepEqual(pointsPerEdition(impact({ domainScores: [{ domain: "sports", score: 9 }, { domain: "health", score: "x" }] })), emptyAreaPoints());
  assert.deepEqual(pointsPerEdition(impact({ proofLevel: null })), emptyAreaPoints());
  assert.deepEqual(buyerPoints(BUYER, [{ editionsHeld: -3, editionsRetired: 0, impact: impact() }]), emptyAreaPoints());
});

test("points add up over several tRWI in the same area without rounding drift", () => {
  const hs = Array.from({ length: 12 }, () => ({ editionsHeld: 1, editionsRetired: 0, impact: impact({ domainScores: [{ domain: "environment", score: 29.98 }] }) }));
  assert.equal(buyerPoints(BUYER, hs).environment, 2.87808); // 12 * 0.23984
});

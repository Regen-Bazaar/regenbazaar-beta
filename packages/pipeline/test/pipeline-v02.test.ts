import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "@rb/db/testing";
import * as schema from "@rb/db/schema";
import {
  processSubmission,
  parseContextV02,
  parseCost,
  parseLocation,
  parseProofLinks,
  parseRegistry,
  sanitizeActionsV02,
} from "../src/index.ts";

async function org(db: Awaited<ReturnType<typeof createTestDb>>["db"], n: string) {
  const [o] = await db
    .insert(schema.organizations)
    .values({ walletAddress: `0x00000000000000000000000000000000000${n}`, name: `Org${n}`, slug: `org${n}` })
    .returning();
  return o;
}

test("new reports are scored and stored with methodology v0.2 by default", async () => {
  const { db } = await createTestDb();
  const o = await org(db, "0b001");
  const { submission, iv } = await processSubmission(db, {
    orgId: o.id,
    title: "Beach cleanup",
    description: "We collected 380 kg of plastic waste and 30 students taught about recycling",
    context: { country: "TH", esm: 1.3 } as never,
    location: { lat: 9.73, lon: 100.02, ecosystem: "coast" },
    proofLinks: ["https://example.org/post/1"],
    registry: { standard: "none" },
  });
  assert.equal(submission.methodologyVersion, "v0.2");
  assert.equal(submission.tablesVersion, iv.tablesVersion);
  assert.equal(iv.impactValue, 380 * 0.05 + 30 * 0.2); // submitter's esm ignored
  assert.equal(submission.ivValue, "25.0000");
  assert.deepEqual(submission.domainScores, iv.domainScores);
  assert.deepEqual(submission.location, { lat: 9.73, lon: 100.02, ecosystem: "coast" });
  assert.deepEqual(submission.proofLinks, ["https://example.org/post/1"]);
  assert.equal(submission.proofLevel, null); // only a validator sets P
  assert.equal(submission.domain, "environment"); // primary domain when none given
  assert.equal((submission.context as Record<string, unknown>).esm, undefined);
});

test("v0.1 reports stay untouched when a v0.2 report is added", async () => {
  const { db } = await createTestDb();
  const o = await org(db, "0b002");
  const old = await processSubmission(
    db,
    { orgId: o.id, title: "Old", description: "1000 trees planted" },
    { methodologyVersion: "v0.1" },
  );
  await processSubmission(db, { orgId: o.id, title: "New", description: "1000 trees planted" });
  const rows = await db.select().from(schema.impactSubmissions);
  const oldRow = rows.find((r) => r.id === old.submission.id)!;
  assert.equal(oldRow.methodologyVersion, "v0.1");
  assert.equal(oldRow.ivValue, old.submission.ivValue);
  assert.equal(oldRow.domainScores, null);
});

test("sanitizeActionsV02 drops unknown keys and keeps only plausible physical details", () => {
  const out = sanitizeActionsV02([
    { actionType: "mangroves_planted", quantity: 3000, unit: "trees", areaHa: 1.2, survivalRate: 0.8, mangroveForm: "tree", extra: "x" },
    { actionType: "trees_planted", quantity: 100, unit: "trees", areaHa: -1, survivalRate: 3, mangroveForm: "giant" },
    { actionType: "moon_landings", quantity: 1, unit: "x" },
    { actionType: "__proto__", quantity: 1, unit: "x" },
    "garbage",
  ]);
  assert.deepEqual(out, [
    { actionType: "mangroves_planted", quantity: 3000, unit: "trees", areaHa: 1.2, survivalRate: 0.8, mangroveForm: "tree" },
    { actionType: "trees_planted", quantity: 100, unit: "trees" },
  ]);
  assert.deepEqual(sanitizeActionsV02("nope"), []);
});

test("parseContextV02: country, ecosystem, adjacency; bad values rejected; esm never accepted", () => {
  const ok = parseContextV02({ country: "th", ecosystem: "mangrove", adjacentToHabitat: true, esm: 1.3 });
  assert.ok(ok.ok);
  assert.deepEqual(ok.value, { country: "TH", ecosystem: "mangrove", adjacentToHabitat: true });
  assert.equal(parseContextV02({ country: "Thailand" }).ok, false);
  assert.equal(parseContextV02({ ecosystem: "moon" }).ok, false);
  assert.equal(parseContextV02({ adjacentToHabitat: "yes" }).ok, false);
  assert.equal(parseContextV02({ complexity: { technicalExpertise: "high" } }).ok, false); // v0.1 rules still apply
});

test("parseLocation: WGS84 ranges", () => {
  assert.deepEqual(parseLocation({ lat: 9.7, lon: 100 }), { ok: true, value: { lat: 9.7, lon: 100 } });
  assert.deepEqual(parseLocation(undefined), { ok: true, value: undefined });
  assert.equal(parseLocation({ lat: 91, lon: 0 }).ok, false);
  assert.equal(parseLocation({ lat: "9.7", lon: 100 }).ok, false);
  assert.equal(parseLocation({ lat: 0, lon: 0, ecosystem: "x" }).ok, false);
});

test("parseProofLinks: https only, no credentials, max 10, deduplicated", () => {
  assert.deepEqual(parseProofLinks(["https://a.org/x", "https://a.org/x"]), { ok: true, value: ["https://a.org/x"] });
  assert.equal(parseProofLinks(["http://a.org"]).ok, false);
  assert.equal(parseProofLinks(["javascript:alert(1)"]).ok, false);
  assert.equal(parseProofLinks(["file:///etc/passwd"]).ok, false);
  assert.equal(parseProofLinks(["https://user:pw@a.org"]).ok, false);
  assert.equal(parseProofLinks(["not a url"]).ok, false);
  assert.equal(parseProofLinks(Array.from({ length: 11 }, (_, i) => `https://a.org/${i}`)).ok, false);
  assert.equal(parseProofLinks("https://a.org").ok, false);
});

test("parseRegistry: known standards, safe serials, no serial without a standard", () => {
  assert.deepEqual(parseRegistry({ standard: "verra", serial: "VCS-1234-2025" }), {
    ok: true,
    value: { standard: "verra", serial: "VCS-1234-2025" },
  });
  assert.equal(parseRegistry({ standard: "acme" }).ok, false);
  assert.equal(parseRegistry({ standard: "none", serial: "123" }).ok, false);
  assert.equal(parseRegistry({ standard: "verra", serial: "<script>" }).ok, false);
});

test("declared actions (form step 2) are scored; the AI reading is kept and edits are marked", async () => {
  const { db } = await createTestDb();
  const o = await org(db, "0b003");
  const { submission, iv } = await processSubmission(db, {
    orgId: o.id,
    title: "Mangroves",
    description: "We planted 3000 mangroves",
    declaredActions: [{ actionType: "mangroves_planted", quantity: 3000, unit: "trees", areaHa: 1.2 }],
  });
  const ctx = submission.context as { aiActions: unknown[]; submitterEdited: boolean };
  assert.equal(ctx.submitterEdited, true); // area added by the NGO
  assert.deepEqual(ctx.aiActions, [{ actionType: "mangroves_planted", quantity: 3000, unit: "trees" }]);
  assert.ok(iv.impactValue > 0);

  const same = await processSubmission(db, {
    orgId: o.id,
    title: "Cleanup",
    description: "Collected 380 kg of waste",
    declaredActions: [{ actionType: "waste_collected_kg", quantity: 380, unit: "kg" }],
  });
  assert.equal((same.submission.context as { submitterEdited: boolean }).submitterEdited, false);
});

test("parseCost: currency code, non-negative bounded amounts, known categories only", () => {
  assert.deepEqual(parseCost({ currency: "thb", volunteerHours: 40, hourlyValue: 50, spent: { materials: 1000, bribes: 5 } }), {
    ok: true,
    value: { currency: "THB", volunteerHours: 40, hourlyValue: 50, spent: { materials: 1000 } },
  });
  assert.deepEqual(parseCost(undefined), { ok: true, value: undefined });
  assert.equal(parseCost({ currency: "baht" }).ok, false);
  assert.equal(parseCost({ currency: "THB", volunteerHours: -1 }).ok, false);
  assert.equal(parseCost({ currency: "THB", spent: { food: "100" } }).ok, false);
  assert.equal(parseCost({ currency: "THB", hourlyValue: 1e9 }).ok, false);
});

test("the cost declaration is stored with the report and does not change IV", async () => {
  const { db } = await createTestDb();
  const o = await org(db, "0b004");
  const base = { orgId: o.id, title: "Cleanup", description: "Collected 380 kg of waste" };
  const a = await processSubmission(db, base);
  const b = await processSubmission(db, { ...base, cost: { currency: "THB", volunteerHours: 40, hourlyValue: 50, spent: { transport: 500 } } });
  assert.equal(b.iv.impactValue, a.iv.impactValue);
  assert.deepEqual((b.submission.context as { cost: unknown }).cost, { currency: "THB", volunteerHours: 40, hourlyValue: 50, spent: { transport: 500 } });
});

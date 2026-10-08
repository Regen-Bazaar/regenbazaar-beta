import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "@rb/db/testing";
import * as schema from "@rb/db/schema";
import { processSubmission, sanitizeActions, createDeepSeekExtractor, parseContext, parseDomain } from "../src/index.ts";

test("processSubmission: extract -> score -> persist into verification queue", async () => {
  const { db } = await createTestDb();
  const [org] = await db
    .insert(schema.organizations)
    .values({ walletAddress: "0x000000000000000000000000000000000000a002", name: "Org", slug: "org" })
    .returning();

  const { submission, iv } = await processSubmission(db, {
    orgId: org.id,
    title: "Restoration",
    description: "1000 trees planted and 5 workshops held",
    context: { regionCode: "temperate" },
    chainId: 11142220,
  }, { methodologyVersion: "v0.1" });

  // trees: 0.1*1000*1.5 = 150 ; workshops: 0.05*5*1.0 = 0.25 -> 150.25
  assert.equal(iv.impactValue, 150.25);
  assert.equal(submission.status, "pending_verification");
  assert.equal(submission.chainId, 11142220); // one report, one network
  assert.equal(submission.ivValue, "150.2500");
  assert.equal(submission.tablesVersion, iv.tablesVersion);
  assert.deepEqual(submission.frameworkTags, iv.frameworkTags);
});

test("LLM extractor path with sanitization of bad output", async () => {
  const { db } = await createTestDb();
  const [org] = await db
    .insert(schema.organizations)
    .values({ walletAddress: "0x000000000000000000000000000000000000a003", name: "Org2", slug: "org2" })
    .returning();

  // a fake extractor returning a valid action plus garbage that must be filtered out
  const extractor = {
    async extract() {
      return [
        { actionType: "trees_planted", quantity: 200, unit: "trees" },
        { actionType: "evil", quantity: -5, unit: "x" }, // negative -> dropped
        { actionType: "x".repeat(99), quantity: 1, unit: "u" }, // too long -> dropped
        { foo: "bar" }, // malformed -> dropped
      ] as never;
    },
  };

  const { submission, iv } = await processSubmission(
    db,
    { orgId: org.id, title: "T", description: "ignored when extractor present" },
    { extractor, methodologyVersion: "v0.1" },
  );

  // only trees_planted 200 survived: 0.1 * 200 * 1.2 (sm>=100) = 24
  assert.equal(iv.impactValue, 24);
  assert.equal((submission.extractedActions as unknown[]).length, 1);
  assert.equal(submission.chainId, null); // no network given -> legacy/default at approval
});

test("deepseek extractor factory constructs (no network)", () => {
  const ex = createDeepSeekExtractor({ apiKey: "sk-test", model: "deepseek-chat" });
  assert.equal(typeof ex.extract, "function");
});

test("sanitizeActions filters non-arrays and invalid entries", () => {
  assert.deepEqual(sanitizeActions("nope"), []);
  assert.deepEqual(sanitizeActions([{ actionType: "a", quantity: 0, unit: "u" }]), []);
  assert.deepEqual(sanitizeActions([{ actionType: "a", quantity: 3, unit: "u" }]), [
    { actionType: "a", quantity: 3, unit: "u" },
  ]);
});

test("parseDomain: accepts the enum, rejects anything else", () => {
  assert.deepEqual(parseDomain("animal_welfare"), { ok: true, value: "animal_welfare" });
  assert.deepEqual(parseDomain(undefined), { ok: true, value: undefined });
  assert.equal(parseDomain("space").ok, false);
  assert.equal(parseDomain(42).ok, false);
});

test("parseContext: known values pass through, unknown values are rejected before scoring", () => {
  const complexity = {
    technicalExpertise: "medium",
    resourceIntensity: "low",
    projectScale: "city",
    regulatory: "low",
    environmentalConditions: "easy",
  };
  const ok = parseContext({
    regionCode: "coral_reef",
    populationDensity: "high",
    complexity,
    periodStart: "2025-01-01",
    periodEnd: "2025-06-30",
    injected: "<script>",
  });
  assert.ok(ok.ok);
  assert.deepEqual(ok.value, {
    regionCode: "coral_reef",
    populationDensity: "high",
    complexity,
    periodStart: "2025-01-01",
    periodEnd: "2025-06-30",
  }); // unknown keys are dropped
  assert.deepEqual(parseContext(undefined), { ok: true, value: {} });

  // Each of these used to reach the formula: NaN IV (complexity) or a silent 1.0 (region).
  assert.equal(parseContext({ complexity: { ...complexity, regulatory: "extreme" } }).ok, false);
  assert.equal(parseContext({ complexity: { technicalExpertise: "high" } }).ok, false);
  assert.equal(parseContext({ regionCode: "Amazon" }).ok, false);
  assert.equal(parseContext({ regionCode: "__proto__" }).ok, false);
  assert.equal(parseContext({ populationDensity: "huge" }).ok, false);
  assert.equal(parseContext({ periodStart: "01/02/2025" }).ok, false);
  assert.equal(parseContext({ periodStart: "2025-06-01", periodEnd: "2025-01-01" }).ok, false);
  assert.equal(parseContext("string").ok, false);
  assert.equal(parseContext([1]).ok, false);
});

test("llm: configured by either key; no provider -> callStructured throws (no network)", async () => {
  const { llmConfigured, callStructured } = await import("../src/llm.ts");
  const saved = { a: process.env.ANTHROPIC_API_KEY, d: process.env.DEEPSEEK_API_KEY };
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.DEEPSEEK_API_KEY;
  try {
    assert.equal(llmConfigured(), false);
    await assert.rejects(callStructured({ system: "s", user: "u", name: "n", description: "d", schema: { type: "object" } }));
    process.env.ANTHROPIC_API_KEY = "sk-test";
    assert.equal(llmConfigured(), true);
  } finally {
    if (saved.a === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = saved.a;
    if (saved.d === undefined) delete process.env.DEEPSEEK_API_KEY; else process.env.DEEPSEEK_API_KEY = saved.d;
  }
});

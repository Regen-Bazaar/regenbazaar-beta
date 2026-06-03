import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "@rb/db/testing";
import * as schema from "@rb/db/schema";
import { processSubmission, sanitizeActions, createAnthropicExtractor } from "../src/index.ts";

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
  });

  // trees: 0.1*1000*1.5 = 150 ; workshops: 0.05*5*1.0 = 0.25 -> 150.25
  assert.equal(iv.impactValue, 150.25);
  assert.equal(submission.status, "pending_verification");
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
    { extractor },
  );

  // only trees_planted 200 survived: 0.1 * 200 * 1.2 (sm>=100) = 24
  assert.equal(iv.impactValue, 24);
  assert.equal((submission.extractedActions as unknown[]).length, 1);
});

test("anthropic extractor factory constructs (no network)", () => {
  const ex = createAnthropicExtractor({ apiKey: "sk-test", model: "x" });
  assert.equal(typeof ex.extract, "function");
});

test("sanitizeActions filters non-arrays and invalid entries", () => {
  assert.deepEqual(sanitizeActions("nope"), []);
  assert.deepEqual(sanitizeActions([{ actionType: "a", quantity: 0, unit: "u" }]), []);
  assert.deepEqual(sanitizeActions([{ actionType: "a", quantity: 3, unit: "u" }]), [
    { actionType: "a", quantity: 3, unit: "u" },
  ]);
});

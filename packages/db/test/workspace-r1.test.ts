import { test } from "node:test";
import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { createTestDb } from "../src/testing.ts";
import * as schema from "../src/schema.ts";

// Migration 0008 is additive: new private tables with safe defaults; existing rows are untouched.
test("0008: workspace tables exist with defaults and existing data is intact", async () => {
  const { db } = await createTestDb();
  const [org] = await db.insert(schema.organizations).values({ walletAddress: "0x000000000000000000000000000000000000a008", name: "Org", slug: "org-0008" }).returning();
  const [sub] = await db.insert(schema.impactSubmissions).values({ orgId: org.id, title: "t", description: "d" }).returning();
  const [st] = await db.insert(schema.reviewState).values({ submissionId: sub.id }).returning();
  assert.equal(st.state, "waiting");
  assert.equal(st.proofStatus, "none");
  assert.deepEqual(st.placeNames, []);
  const [page] = await db.insert(schema.proofPages).values({ submissionId: sub.id, kind: "proof", url: "https://example.com/a" }).returning();
  assert.equal(page.reader, "none");
  assert.equal(page.truncated, false);
  await assert.rejects(db.insert(schema.proofPages).values({ submissionId: sub.id, kind: "proof", url: "https://example.com/a" }), "one row per impact and link");
  const [run] = await db.insert(schema.aiRuns).values({ job: "moderation", provider: "anthropic", model: "m", instructionVersion: "v1", durationMs: 5, ok: true }).returning();
  assert.equal(run.submissionId, null);
  const [note] = await db.insert(schema.reviewNotes).values({ submissionId: sub.id, body: "internal" }).returning();
  assert.equal(note.authorId, null);
  const [after] = await db.select().from(schema.impactSubmissions).where(eq(schema.impactSubmissions.id, sub.id));
  assert.equal(after.title, "t");
  const cols = await db.execute(sql`select count(*)::int as n from information_schema.columns where table_name = 'impact_submissions'`);
  assert.ok(Number((cols as unknown as { rows?: { n: number }[] }).rows?.[0]?.n ?? 0) > 0);
});

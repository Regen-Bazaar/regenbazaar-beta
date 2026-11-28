import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { createTestDb } from "../src/testing.ts";
import * as schema from "../src/schema.ts";

// Migration 0007 is additive: an existing-style listing gets generation 3 and no withdrawal or limit state.
test("0007: listing defaults and withdrawal requests", async () => {
  const { db } = await createTestDb();
  const [org] = await db.insert(schema.organizations).values({ walletAddress: "0x000000000000000000000000000000000000a007", name: "Org", slug: "org-0007" }).returning();
  const [sub] = await db.insert(schema.impactSubmissions).values({ orgId: org.id, title: "t", description: "d" }).returning();
  const [l] = await db
    .insert(schema.listings)
    .values({
      submissionId: sub.id,
      tokenId: "1",
      totalIvWei: "1",
      maxEditions: 100,
      pricePerEdition: "1",
      currency: "0x0000000000000000000000000000000000000000",
      beneficiary: org.walletAddress,
      easUid: "0x" + "11".repeat(32),
      metadataUri: "ipfs://x",
    })
    .returning();
  assert.equal(l.contractGeneration, 3);
  assert.equal(l.withdrawnAt, null);
  assert.equal(l.firstSaleAt, null);
  assert.equal(l.editionLimitLiftedAt, null);

  const [r] = await db.insert(schema.withdrawalRequests).values({ listingId: l.id, reason: "photos reused from another project" }).returning();
  assert.equal(r.status, "open");
  await assert.rejects(db.insert(schema.withdrawalRequests).values({ listingId: l.id, reason: "second open request" }), "one open request per listing");
  await db.update(schema.withdrawalRequests).set({ status: "rejected" }).where(eq(schema.withdrawalRequests.id, r.id));
  await db.insert(schema.withdrawalRequests).values({ listingId: l.id, reason: "new request after a rejection" });
  await assert.rejects(db.insert(schema.withdrawalRequests).values({ listingId: "00000000-0000-4000-8000-000000000000", reason: "x" }));
  const rows = await db.select().from(schema.withdrawalRequests).where(eq(schema.withdrawalRequests.listingId, l.id));
  assert.equal(rows.length, 2);
});

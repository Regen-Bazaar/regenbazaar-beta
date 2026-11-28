import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "../src/testing.ts";
import * as schema from "../src/schema.ts";

// Migration 0009 is additive: three new tables for the purchase record; existing rows are untouched.
test("0009: purchase record tables exist, an event is stored once, existing data is intact", async () => {
  const { db } = await createTestDb();
  const [org] = await db.insert(schema.organizations).values({ walletAddress: "0x000000000000000000000000000000000000a009", name: "Org", slug: "org-0009" }).returning();
  const [sub] = await db.insert(schema.impactSubmissions).values({ orgId: org.id, title: "t", description: "d" }).returning();
  const event = {
    chainId: 421614,
    contract: "0x00000000000000000000000000000000000000a1",
    tokenContract: "0x00000000000000000000000000000000000000a1",
    kind: "transferred",
    tokenId: "5",
    amount: "3",
    fromAddress: "0x0000000000000000000000000000000000000000",
    toAddress: "0x00000000000000000000000000000000000000b1",
    blockNumber: 333368639,
    blockTime: new Date("2026-11-28T00:00:00Z"),
    txHash: `0x${"1".repeat(64)}`,
    logIndex: 4,
  };
  const [row] = await db.insert(schema.editionEvents).values(event).returning();
  assert.equal(row.batchIndex, 0);
  assert.equal(row.wallet, null);
  assert.equal(row.blockNumber, 333368639);
  await assert.rejects(db.insert(schema.editionEvents).values(event), "the same log is stored once");
  assert.equal((await db.insert(schema.editionEvents).values(event).onConflictDoNothing().returning()).length, 0);
  await db.insert(schema.editionEvents).values({ ...event, batchIndex: 1 }); // another position of the same batch log

  const holding = { chainId: 421614, tokenContract: event.tokenContract, tokenId: "5", wallet: event.toAddress };
  const [h] = await db.insert(schema.holdings).values(holding).returning();
  assert.deepEqual([h.editionsHeld, h.editionsRetired], ["0", "0"]);
  await assert.rejects(db.insert(schema.holdings).values(holding), "one row per wallet and tRWI");

  await db.insert(schema.recordCursors).values({ chainId: 421614, contract: event.contract, lastBlock: 1 });
  await assert.rejects(db.insert(schema.recordCursors).values({ chainId: 421614, contract: event.contract, lastBlock: 2 }), "one position per contract");

  assert.equal((await db.select().from(schema.impactSubmissions)).find((s) => s.id === sub.id)?.title, "t");
});

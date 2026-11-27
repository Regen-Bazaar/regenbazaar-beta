import { test } from "node:test";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { createTestDb } from "../src/testing.ts";
import { createFirstAdmin } from "../src/first-admin.ts";
import { actionLog, users } from "../src/schema.ts";

const W = "0x" + "AbCd".repeat(10);

test("first admin: created once, lower-case wallet, one log line; a second needs the explicit flag", async () => {
  const { db } = await createTestDb();
  const a = await createFirstAdmin(db as never, W, "Paul");
  assert.equal(a.role, "admin");
  assert.equal(a.walletAddress, W.toLowerCase());
  const lines = await db.select().from(actionLog).where(eq(actionLog.action, "first_admin"));
  assert.equal(lines.length, 1);
  await assert.rejects(() => createFirstAdmin(db as never, "0x" + "1".repeat(40), "Other"), /already exists/);
  const b = await createFirstAdmin(db as never, "0x" + "1".repeat(40), "Other", { allowExisting: true });
  assert.equal(b.role, "admin");
  assert.equal((await db.select().from(users)).length, 2);
});

test("first admin: bad wallet or name is refused", async () => {
  const { db } = await createTestDb();
  await assert.rejects(() => createFirstAdmin(db as never, "0x123", "Paul"), /0x address/);
  await assert.rejects(() => createFirstAdmin(db as never, W, "P"), /name/);
});

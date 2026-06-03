import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { eq } from "drizzle-orm";
import * as schema from "../src/schema.ts";
import { seedActionWeights, SEED_VERSION } from "../src/seed.ts";

test("migrate + full submission lifecycle + seed on PGlite", async () => {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./migrations" });

  const [org] = await db
    .insert(schema.organizations)
    .values({
      walletAddress: "0x000000000000000000000000000000000000a001",
      name: "Clean Phangan",
      slug: "clean-phangan",
    })
    .returning();
  assert.ok(org.id);
  assert.equal(org.verified, false);

  // draft -> pending_verification (scored)
  const [sub] = await db
    .insert(schema.impactSubmissions)
    .values({
      orgId: org.id,
      title: "Beach cleanup Q2",
      description: "Collected 1500 kg of plastic from the beach.",
      domain: "environment",
      status: "draft",
    })
    .returning();
  assert.equal(sub.status, "draft");

  await db
    .update(schema.impactSubmissions)
    .set({
      status: "pending_verification",
      ivValue: "225.0000",
      tablesVersion: SEED_VERSION,
      frameworkTags: { sdg: ["SDG-12"], ebf: ["water"] },
    })
    .where(eq(schema.impactSubmissions.id, sub.id));

  // validator approves -> verified
  await db.insert(schema.verifications).values({ submissionId: sub.id, decision: "approve", note: "evidence ok" });
  await db.update(schema.impactSubmissions).set({ status: "verified" }).where(eq(schema.impactSubmissions.id, sub.id));

  // off-chain -> on-chain links, then tokenized
  await db.insert(schema.attestations).values({ submissionId: sub.id, easUid: "0x" + "ab".repeat(32) });
  await db.insert(schema.tokenizations).values({ submissionId: sub.id, tokenId: "1", editions: 100 });
  await db.update(schema.impactSubmissions).set({ status: "tokenized" }).where(eq(schema.impactSubmissions.id, sub.id));

  const [final] = await db.select().from(schema.impactSubmissions).where(eq(schema.impactSubmissions.id, sub.id));
  assert.equal(final.status, "tokenized");
  assert.equal(final.ivValue, "225.0000");

  // seed versioned action-weight table
  await seedActionWeights(db);
  const aws = await db.select().from(schema.actionWeights);
  assert.equal(aws.length, 6);
  const trees = aws.find((a) => a.actionType === "trees_planted");
  assert.equal(trees?.version, SEED_VERSION);
  assert.deepEqual(trees?.sdg, ["SDG-13", "SDG-15"]);

  // seeding is idempotent (onConflictDoNothing on version+action_type)
  await seedActionWeights(db);
  const aws2 = await db.select().from(schema.actionWeights);
  assert.equal(aws2.length, 6);
});

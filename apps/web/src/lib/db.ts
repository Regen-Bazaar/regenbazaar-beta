import * as schema from "@rb/db/schema";
import { eq } from "drizzle-orm";
import type { DB } from "@rb/db";

let _dbPromise: Promise<DB> | null = null;

async function init(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { createPostgresDb } = await import("@rb/db");
    return createPostgresDb(url).db;
  }
  // Local dev (no Docker): in-process PGlite seeded from the schema snapshot. Resets on dev-server restart.
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { DEV_SCHEMA_SQL } = await import("./dev-schema");
  // Persistent file so data survives Next-dev module re-evaluation between requests.
  const client = new PGlite(process.env.PGLITE_DIR ?? ".pglite-dev");
  await client.exec(DEV_SCHEMA_SQL);
  const db = drizzle(client, { schema }) as unknown as DB;
  await db
    .insert(schema.organizations)
    .values({
      walletAddress: "0x000000000000000000000000000000000000d3m0",
      name: "Clean Phangan",
      slug: "clean-phangan",
    })
    .onConflictDoNothing();
  return db;
}

/** Singleton DB for the server process: Postgres when DATABASE_URL is set, else in-process dev PGlite. */
export function getDb(): Promise<DB> {
  if (!_dbPromise) _dbPromise = init();
  return _dbPromise;
}

/** Demo NGO id (used until wallet-based org auth lands). */
export async function getDemoOrgId(db: DB): Promise<string> {
  const [org] = await db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.slug, "clean-phangan"))
    .limit(1);
  return org.id;
}

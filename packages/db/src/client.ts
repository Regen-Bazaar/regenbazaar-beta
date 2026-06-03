// DB client factories.
//  - createPgliteDb(): in-process Postgres (PGlite) for local dev/tests — no Docker needed.
//  - production uses a real Postgres on the VPS; wire a node-postgres/postgres-js client here later,
//    selected via env (DATABASE_URL). Schema + queries are identical (postgresql dialect).

import { drizzle } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.ts";

// Driver-agnostic DB type: both the PGlite (dev) and postgres-js (prod) drivers return a PgDatabase
// subtype over the same schema, and we only use core insert/select/update — so handlers/pipeline work
// against either without change.
export type DB = PgDatabase<any, typeof schema, any>;

/** In-process Postgres (PGlite). Pass a path to persist, omit for ephemeral in-memory. Dev/tests only. */
export function createPgliteDb(dataDir?: string): { db: DB; client: PGlite } {
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema }) as unknown as DB;
  return { db, client };
}

/** Production Postgres client (postgres-js). Pass a DATABASE_URL. */
export function createPostgresDb(url: string): { db: DB; client: ReturnType<typeof postgres> } {
  const client = postgres(url);
  const db = drizzlePg(client, { schema }) as unknown as DB;
  return { db, client };
}

/** Ephemeral in-memory DB with all migrations applied — for dev/tests (no Docker). */
export async function createTestDb(): Promise<{ db: DB; client: PGlite }> {
  const { db, client } = createPgliteDb();
  const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
  await migrate(db, { migrationsFolder });
  return { db, client };
}

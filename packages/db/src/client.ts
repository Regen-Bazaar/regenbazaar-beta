// DB client factories.
//  - createPgliteDb(): in-process Postgres (PGlite) for local dev/tests — no Docker needed.
//  - production uses a real Postgres on the VPS; wire a node-postgres/postgres-js client here later,
//    selected via env (DATABASE_URL). Schema + queries are identical (postgresql dialect).

import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { PGlite } from "@electric-sql/pglite";
import { fileURLToPath } from "node:url";
import * as schema from "./schema.ts";

export type DB = ReturnType<typeof drizzle<typeof schema>>;

/** In-process Postgres. Pass a path to persist, omit for ephemeral in-memory. */
export function createPgliteDb(dataDir?: string): { db: DB; client: PGlite } {
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  return { db, client };
}

/** Ephemeral in-memory DB with all migrations applied — for dev/tests (no Docker). */
export async function createTestDb(): Promise<{ db: DB; client: PGlite }> {
  const { db, client } = createPgliteDb();
  const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
  await migrate(db, { migrationsFolder });
  return { db, client };
}

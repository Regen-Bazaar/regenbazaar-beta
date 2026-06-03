// DB client factories.
//  - createPgliteDb(): in-process Postgres (PGlite) for local dev/tests — no Docker needed.
//  - createPostgresDb(): production Postgres (postgres-js), selected via DATABASE_URL.
// Schema + queries are identical (postgresql dialect). The migration-applying test helper lives in
// ./testing.ts (kept out of this module so app bundlers don't pull `new URL("../migrations", ...)`).

import { drizzle } from "drizzle-orm/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "./schema.ts";

// Driver-agnostic DB type: both the PGlite (dev) and postgres-js (prod) drivers return a PgDatabase
// subtype over the same schema, and we only use core insert/select/update — so handlers/pipeline work
// against either without change.
export type DB = PgDatabase<any, typeof schema, any>;

/** In-process Postgres (PGlite). Pass a path to persist, omit for ephemeral in-memory. Dev/tests only. */
export function createPgliteDb(dataDir?: string) {
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  return { db, client };
}

/** Production Postgres client (postgres-js). Pass a DATABASE_URL. */
export function createPostgresDb(url: string) {
  const client = postgres(url);
  const db = drizzlePg(client, { schema });
  return { db, client };
}

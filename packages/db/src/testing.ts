// Dev/test helper that applies migrations to an in-memory PGlite. Kept in a SEPARATE entry (not in the
// package index) because it uses `new URL("../migrations", import.meta.url)`, which app bundlers try to
// resolve. Tests/scripts import it via "@rb/db/testing"; the Next app never bundles it.

import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import { createPgliteDb } from "./client.ts";

/** Ephemeral in-memory DB with all migrations applied (no Docker). */
export async function createTestDb() {
  const { db, client } = createPgliteDb();
  const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
  await migrate(db, { migrationsFolder });
  return { db, client };
}

// Apply Drizzle migrations to a production Postgres database (DATABASE_URL). Run once per deploy,
// before the web container starts serving. Uses the same migrations/ folder the dev/test PGlite path
// applies (proven by @rb/db tests), via the postgres-js migrator.
//   CLI:  DATABASE_URL=postgres://… node --experimental-strip-types src/migrate.ts

import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { createPostgresDb } from "./client.ts";

export async function runMigrations(url: string | undefined = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is required to run migrations");
  const { db, client } = createPostgresDb(url);
  const migrationsFolder = fileURLToPath(new URL("../migrations", import.meta.url));
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await client.end();
  }
}

// Run when invoked directly (not when imported).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log("migrations applied");
      process.exit(0);
    })
    .catch((err) => {
      console.error("migration failed:", err);
      process.exit(1);
    });
}

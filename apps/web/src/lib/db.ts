import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@rb/db/schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/** Lazily create a singleton Postgres connection (prod + server dev). Requires DATABASE_URL. */
export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  _db = drizzle(postgres(url), { schema });
  return _db;
}

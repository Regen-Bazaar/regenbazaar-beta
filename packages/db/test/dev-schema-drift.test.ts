import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "../src/testing.ts";
import { createPgliteDb } from "../src/client.ts";
import { DEV_SCHEMA_SQL } from "../src/dev-schema.ts";

// Introspect the public schema so the comparison is robust to SQL formatting — it compares the
// resulting structure (tables, columns, types, nullability, sizes), not the SQL text.
const COLUMNS_SQL = `
  SELECT table_name, column_name, data_type, is_nullable,
         coalesce(character_maximum_length, -1) AS char_len,
         coalesce(numeric_precision, -1)        AS num_prec,
         coalesce(numeric_scale, -1)            AS num_scale
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, column_name;`;

async function introspect(client: { query: (sql: string) => Promise<{ rows: Record<string, unknown>[] }> }) {
  const res = await client.query(COLUMNS_SQL);
  return res.rows.map(
    (r) => `${r.table_name}.${r.column_name}:${r.data_type}:${r.is_nullable}:${r.char_len}:${r.num_prec}:${r.num_scale}`,
  );
}

// Guards the documented fragility: the dev PGlite snapshot must stay structurally identical to the
// real Drizzle migrations, or local dev silently diverges from production.
test("dev-schema snapshot matches the migrations (no drift)", async () => {
  const migrated = await createTestDb(); // real migrations applied
  const dev = createPgliteDb(); // fresh in-memory
  await dev.client.exec(DEV_SCHEMA_SQL);

  const migratedCols = await introspect(migrated.client);
  const devCols = await introspect(dev.client);

  assert.ok(migratedCols.length > 0, "migration introspection returned no columns");
  assert.deepEqual(devCols, migratedCols);
});

// First-admin command: makes one wallet an admin. Run on the server, deliberately, once at the switch to
// personal validator accounts, and again only if the last admin lost their wallet. There is no API route
// that does this, so the first admin can only be created here. Writes a `first_admin` line to the action log.
//   CLI: DATABASE_URL=postgres://… node --experimental-strip-types src/first-admin.ts 0xWALLET "Name" [--allow-existing]
//   (in the deployed stack: docker compose run --rm migrate pnpm --filter @rb/db first-admin 0xWALLET "Name")
import { and, eq, isNull, sql } from "drizzle-orm";
import { actionLog, users } from "./schema.ts";
import type { DB } from "./client.ts";

export async function createFirstAdmin(db: DB, wallet: string, name: string, opts: { allowExisting?: boolean } = {}) {
  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) throw new Error("wallet must be an 0x address");
  const w = wallet.toLowerCase();
  const displayName = name.trim();
  if (displayName.length < 2 || displayName.length > 80) throw new Error("name must be 2 to 80 characters");
  // Count, user write and log line commit together, one run at a time (advisory lock), so two runs cannot both create the first admin.
  const row = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(7300001)`);
    const admins = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.active, true), isNull(users.removedAt)));
    if (admins.length > 0 && !opts.allowExisting) {
      throw new Error("an active admin already exists; add people on the team screen, or pass --allow-existing (lost admin wallet)");
    }
    const [existing] = await tx.select().from(users).where(eq(users.walletAddress, w)).limit(1);
    const fields = { role: "admin" as const, displayName, active: true, removedAt: null };
    const [saved] = existing
      ? await tx.update(users).set(fields).where(eq(users.id, existing.id)).returning()
      : await tx.insert(users).values({ walletAddress: w, ...fields }).returning();
    await tx.insert(actionLog).values({
      actorId: null,
      actorName: "server command",
      action: "first_admin",
      objectType: "validator",
      objectId: saved.id,
      before: existing ? { role: existing.role, active: existing.active } : null,
      after: { wallet: w, name: displayName, role: "admin" },
      result: "done",
    });
    return saved;
  });
  return row;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const [wallet, name, flag] = process.argv.slice(2);
  const url = process.env.DATABASE_URL;
  if (!url || !wallet || !name) {
    console.error('usage: DATABASE_URL=… first-admin <0xWALLET> "<Name>" [--allow-existing]');
    process.exit(2);
  }
  const { createPostgresDb } = await import("./client.ts");
  const { db, client } = createPostgresDb(url);
  try {
    const row = await createFirstAdmin(db, wallet, name, { allowExisting: flag === "--allow-existing" });
    console.log(`admin created: ${row.displayName} ${row.walletAddress}`);
    await client.end();
    process.exit(0);
  } catch (err) {
    console.error("first-admin failed:", err instanceof Error ? err.message : err);
    await client.end();
    process.exit(1);
  }
}

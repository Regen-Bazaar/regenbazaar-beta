import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import { users } from "@rb/db/schema";
import { getDb } from "../../../lib/db";
import { logAction } from "../../../lib/action-log";
import { isWalletString, normalizeWallet, requireActor } from "../../../lib/validator-auth";

export const runtime = "nodejs";

const ROLES = ["validator", "admin"] as const;

// GET /api/validators — admin only: the team (removed accounts included, marked).
export async function GET(req: Request) {
  const a = await requireActor(req, "admin");
  if ("response" in a) return a.response;
  const db = await getDb();
  const rows = await db
    .select({ id: users.id, wallet: users.walletAddress, name: users.displayName, role: users.role, active: users.active, removedAt: users.removedAt, addedBy: users.addedBy, createdAt: users.createdAt })
    .from(users)
    .where(inArray(users.role, [...ROLES]))
    .orderBy(desc(users.createdAt));
  // Removed accounts keep their role value, so they stay in the list.
  return NextResponse.json(rows);
}

// POST /api/validators { wallet, name, role } — admin only. Adding a removed wallet again re-activates it.
export async function POST(req: Request) {
  const a = await requireActor(req, "admin");
  if ("response" in a) return a.response;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!isWalletString(body.wallet)) return NextResponse.json({ error: "wallet must be an 0x address" }, { status: 422 });
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 80) return NextResponse.json({ error: "name must be 2 to 80 characters" }, { status: 422 });
  if (!ROLES.includes(body.role as never)) return NextResponse.json({ error: "role must be validator or admin" }, { status: 422 });
  const role = body.role as (typeof ROLES)[number];
  const wallet = normalizeWallet(body.wallet);

  const db = await getDb();
  const [existing] = await db.select().from(users).where(eq(users.walletAddress, wallet)).limit(1);
  if (existing && existing.active && (existing.role === "validator" || existing.role === "admin")) {
    return NextResponse.json({ error: "this wallet is already on the team" }, { status: 409 });
  }
  let row;
  if (existing) {
    [row] = await db
      .update(users)
      .set({ role, displayName: name, active: true, removedAt: null, addedBy: a.actor.userId })
      .where(eq(users.id, existing.id))
      .returning();
  } else {
    [row] = await db.insert(users).values({ walletAddress: wallet, displayName: name, role, addedBy: a.actor.userId }).returning();
  }
  await logAction(db, a.actor, {
    action: "validator_add",
    objectType: "validator",
    objectId: row.id,
    before: existing ? { role: existing.role, active: existing.active } : null,
    after: { wallet, name, role },
  });
  return NextResponse.json({ id: row.id, wallet, name, role, active: true }, { status: 201 });
}

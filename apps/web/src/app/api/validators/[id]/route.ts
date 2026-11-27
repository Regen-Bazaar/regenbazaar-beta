import { NextResponse } from "next/server";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { users, validatorSessions } from "@rb/db/schema";
import { getDb } from "../../../../lib/db";
import { logAction } from "../../../../lib/action-log";
import { requireActor } from "../../../../lib/validator-auth";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH /api/validators/<id> — admin only. Body: { role } | { remove: true } | { endSessions: true }.
// The last active admin cannot be removed or demoted. Removed accounts are marked, never deleted.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireActor(req, "admin");
  if ("response" in a) return a.response;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "validator not found" }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const db = await getDb();
  const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!target || (target.role !== "validator" && target.role !== "admin")) {
    return NextResponse.json({ error: "validator not found" }, { status: 404 });
  }
  // Admin membership changes run one at a time (transaction-scoped advisory lock), and the account change and the
  // ending of its sessions commit together, so the last admin cannot be removed by two overlapping requests and a
  // removed account never keeps a live session.
  const ADMIN_LOCK = 7_300_001;
  const activeAdminsOtherThan = async (tx: Pick<typeof db, "select">) => {
    const [{ n }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.active, true), isNull(users.removedAt), ne(users.id, id)));
    return n;
  };
  const revokeAll = (tx: Pick<typeof db, "update">) =>
    tx.update(validatorSessions).set({ revokedAt: new Date() }).where(and(eq(validatorSessions.userId, id), isNull(validatorSessions.revokedAt)));

  if (body.endSessions === true) {
    await revokeAll(db);
    return NextResponse.json({ ok: true });
  }
  if (body.remove === true) {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${ADMIN_LOCK})`);
      const [t] = await tx.select().from(users).where(eq(users.id, id)).limit(1);
      if (!t || !t.active) return "already removed" as const;
      if (t.role === "admin" && (await activeAdminsOtherThan(tx)) === 0) return "last admin" as const;
      await tx.update(users).set({ active: false, removedAt: new Date() }).where(eq(users.id, id));
      await revokeAll(tx);
      return "ok" as const;
    });
    if (result === "already removed") return NextResponse.json({ error: "already removed" }, { status: 409 });
    if (result === "last admin") return NextResponse.json({ error: "the last active admin cannot be removed" }, { status: 409 });
    await logAction(db, a.actor, {
      action: "validator_remove",
      objectType: "validator",
      objectId: id,
      before: { wallet: target.walletAddress, name: target.displayName, role: target.role, active: true },
      after: { active: false },
    });
    return NextResponse.json({ ok: true });
  }
  if (body.role === "validator" || body.role === "admin") {
    const newRole = body.role;
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${ADMIN_LOCK})`);
      const [t] = await tx.select().from(users).where(eq(users.id, id)).limit(1);
      if (!t || !t.active) return "removed" as const;
      if (t.role === newRole) return "unchanged" as const;
      if (newRole === "validator" && t.role === "admin" && (await activeAdminsOtherThan(tx)) === 0) return "last admin" as const;
      await tx.update(users).set({ role: newRole }).where(eq(users.id, id));
      return "ok" as const;
    });
    if (result === "removed") return NextResponse.json({ error: "this account is removed" }, { status: 409 });
    if (result === "unchanged") return NextResponse.json({ error: "role is unchanged" }, { status: 409 });
    if (result === "last admin") return NextResponse.json({ error: "the last active admin cannot be demoted" }, { status: 409 });
    await logAction(db, a.actor, {
      action: "role_change",
      objectType: "validator",
      objectId: id,
      before: { role: target.role },
      after: { role: newRole },
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "send role, remove or endSessions" }, { status: 422 });
}

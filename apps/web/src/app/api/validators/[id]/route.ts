import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
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
  const endSessions = () =>
    db.update(validatorSessions).set({ revokedAt: new Date() }).where(and(eq(validatorSessions.userId, id), isNull(validatorSessions.revokedAt)));
  const isLastAdmin = async () => {
    if (target.role !== "admin" || !target.active) return false;
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, "admin"), eq(users.active, true), isNull(users.removedAt)));
    return n <= 1;
  };

  if (body.endSessions === true) {
    await endSessions();
    return NextResponse.json({ ok: true });
  }
  if (body.remove === true) {
    if (!target.active) return NextResponse.json({ error: "already removed" }, { status: 409 });
    if (await isLastAdmin()) return NextResponse.json({ error: "the last active admin cannot be removed" }, { status: 409 });
    await db.update(users).set({ active: false, removedAt: new Date() }).where(eq(users.id, id));
    await endSessions();
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
    if (!target.active) return NextResponse.json({ error: "this account is removed" }, { status: 409 });
    if (body.role === target.role) return NextResponse.json({ error: "role is unchanged" }, { status: 409 });
    if (body.role === "validator" && (await isLastAdmin())) {
      return NextResponse.json({ error: "the last active admin cannot be demoted" }, { status: 409 });
    }
    await db.update(users).set({ role: body.role }).where(eq(users.id, id));
    await logAction(db, a.actor, {
      action: "role_change",
      objectType: "validator",
      objectId: id,
      before: { role: target.role },
      after: { role: body.role },
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "send role, remove or endSessions" }, { status: 422 });
}

import { NextResponse } from "next/server";
import { listings } from "@rb/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../../lib/db";
import { requireActor } from "../../../../../lib/validator-auth";
import { logAction } from "../../../../../lib/action-log";

export const runtime = "nodejs";

// DELETE /api/listings/<id>/partner — detach the partner: later vouchers pay creator + platform only.
// A voucher signed in the last hour (DEADLINE_SECS) still carries the partner share until it expires.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireActor(req, "admin");
  if ("response" in a) return a.response;
  const { id } = await ctx.params;
  const db = await getDb();
  const [before] = await db.select({ partnerId: listings.partnerId }).from(listings).where(eq(listings.id, id)).limit(1);
  const [updated] = await db.update(listings).set({ partnerId: null }).where(eq(listings.id, id)).returning({ id: listings.id });
  if (!updated) return NextResponse.json({ error: "listing not found" }, { status: 404 });
  await logAction(db, a.actor, { action: "partner_detach", objectType: "listing", objectId: id, before: { partnerId: before?.partnerId ?? null }, after: { partnerId: null } });
  return NextResponse.json({ ok: true });
}

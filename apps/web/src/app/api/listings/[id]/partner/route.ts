import { NextResponse } from "next/server";
import { listings } from "@rb/db/schema";
import { and, eq } from "drizzle-orm";
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
  if (!before) return NextResponse.json({ error: "listing not found" }, { status: 404 });
  if (before.partnerId) {
    // Conditional on the partner we read: an overlapping request that already detached it writes no second line.
    const [changed] = await db
      .update(listings)
      .set({ partnerId: null })
      .where(and(eq(listings.id, id), eq(listings.partnerId, before.partnerId)))
      .returning({ id: listings.id });
    if (changed) await logAction(db, a.actor, { action: "partner_detach", objectType: "listing", objectId: id, before: { partnerId: before.partnerId }, after: { partnerId: null } });
  }
  return NextResponse.json({ ok: true });
}

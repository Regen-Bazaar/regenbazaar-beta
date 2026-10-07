import { NextResponse } from "next/server";
import { listings } from "@rb/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../../lib/db";
import { isAdmin } from "../../../../../lib/admin";

export const runtime = "nodejs";

// DELETE /api/listings/<id>/partner — detach the partner: later vouchers pay creator + platform only.
// A voucher signed in the last hour (DEADLINE_SECS) still carries the partner share until it expires.
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "validator access required" }, { status: 401 });
  const { id } = await ctx.params;
  const db = await getDb();
  const [updated] = await db.update(listings).set({ partnerId: null }).where(eq(listings.id, id)).returning({ id: listings.id });
  if (!updated) return NextResponse.json({ error: "listing not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

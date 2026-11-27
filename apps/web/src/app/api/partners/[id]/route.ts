import { NextResponse } from "next/server";
import { partners } from "@rb/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../lib/db";
import { requireActor } from "../../../../lib/validator-auth";
import { logAction } from "../../../../lib/action-log";

export const runtime = "nodejs";

// PATCH /api/partners/<id> — pause or resume a partner. Name, address and share are not editable:
// a paused partner's lots stop selling until resumed or detached.
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireActor(req, "admin");
  if ("response" in a) return a.response;
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body.active !== "boolean") return NextResponse.json({ error: "active (true/false) is required" }, { status: 422 });
  const db = await getDb();
  const [before] = await db.select({ active: partners.active }).from(partners).where(eq(partners.id, id)).limit(1);
  const [updated] = await db.update(partners).set({ active: body.active }).where(eq(partners.id, id)).returning();
  if (!updated) return NextResponse.json({ error: "partner not found" }, { status: 404 });
  await logAction(db, a.actor, {
    action: body.active ? "partner_resume" : "partner_pause",
    objectType: "partner",
    objectId: id,
    before: { active: before?.active ?? null },
    after: { active: updated.active },
  });
  return NextResponse.json(updated);
}

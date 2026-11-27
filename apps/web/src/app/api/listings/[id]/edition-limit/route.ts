import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { listings } from "@rb/db/schema";
import { getDb } from "../../../../../lib/db";
import { requireActor } from "../../../../../lib/validator-auth";
import { logAction } from "../../../../../lib/action-log";

export const runtime = "nodejs";

// POST /api/listings/<id>/edition-limit — admin only: lift the edition limit of one impact by hand
// (e.g. a company buying the whole impact). {note} is required and goes to the action log.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireActor(req, "admin");
  if ("response" in a) return a.response;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "listing not found" }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length < 3) return NextResponse.json({ error: "a note saying why is required" }, { status: 422 });
  const db = await getDb();
  const [l] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  if (!l) return NextResponse.json({ error: "listing not found" }, { status: 404 });
  if (l.editionLimitLiftedAt) return NextResponse.json({ ok: true, liftedAt: l.editionLimitLiftedAt, existing: true });
  const now = new Date();
  await db.update(listings).set({ editionLimitLiftedAt: now, editionLimitLiftedBy: a.actor.userId }).where(eq(listings.id, id));
  await logAction(db, a.actor, { action: "edition_limit_lift", objectType: "listing", objectId: id, before: { liftedAt: null }, after: { liftedAt: now.toISOString() }, note });
  return NextResponse.json({ ok: true, liftedAt: now });
}

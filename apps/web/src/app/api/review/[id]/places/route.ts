import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { impactSubmissions, reviewState } from "@rb/db/schema";
import { getDb } from "../../../../../lib/db";
import { requireActor } from "../../../../../lib/validator-auth";
import { logAction } from "../../../../../lib/action-log";
import { cleanPlaceNames, ensureState, recomputeFlags } from "../../../../../lib/review";

export const runtime = "nodejs";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PUT /api/review/<id>/places { placeNames: string[] } — place names typed by a validator (up to 5). They are saved
// and the place check is re-run on the stored page text: no new fetch, no AI call.
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireActor(req);
  if ("response" in a) return a.response;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!Array.isArray(body.placeNames)) return NextResponse.json({ error: "placeNames must be a list" }, { status: 422 });
  const placeNames = cleanPlaceNames(body.placeNames);
  const db = await getDb();
  const [s] = await db.select({ id: impactSubmissions.id }).from(impactSubmissions).where(eq(impactSubmissions.id, id)).limit(1);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  const before = (await ensureState(db, id)).placeNames;
  await db.update(reviewState).set({ placeNames, updatedAt: new Date() }).where(eq(reviewState.submissionId, id));
  await recomputeFlags(db, id, placeNames);
  await logAction(db, a.actor, { action: "set_place_names", objectType: "impact", objectId: id, before: { placeNames: before }, after: { placeNames } });
  const [row] = await db.select({ proofChecks: impactSubmissions.proofChecks }).from(impactSubmissions).where(eq(impactSubmissions.id, id)).limit(1);
  return NextResponse.json({ ok: true, placeNames, proofChecks: row?.proofChecks ?? null });
}

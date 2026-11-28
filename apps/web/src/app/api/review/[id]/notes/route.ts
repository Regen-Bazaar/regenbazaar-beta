import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { impactSubmissions, reviewNotes } from "@rb/db/schema";
import { getDb } from "../../../../../lib/db";
import { requireActor } from "../../../../../lib/validator-auth";
import { logAction } from "../../../../../lib/action-log";
import { MAX_NOTE_CHARS } from "../../../../../lib/review";

export const runtime = "nodejs";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/review/<id>/notes { body } — an internal note between validators. Only added, never edited; never public.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
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
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) return NextResponse.json({ error: "the note is empty" }, { status: 422 });
  if (text.length > MAX_NOTE_CHARS) return NextResponse.json({ error: `a note is limited to ${MAX_NOTE_CHARS} characters` }, { status: 422 });
  const db = await getDb();
  const [s] = await db.select({ id: impactSubmissions.id }).from(impactSubmissions).where(eq(impactSubmissions.id, id)).limit(1);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [n] = await db
    .insert(reviewNotes)
    .values({
      submissionId: id,
      authorId: a.actor.userId,
      authorName: a.actor.name ?? (a.actor.via === "shared" ? "shared access code" : null),
      authorWallet: a.actor.wallet,
      body: text,
    })
    .returning();
  await logAction(db, a.actor, { action: "add_note", objectType: "impact", objectId: id, after: { noteId: n.id, characters: text.length } });
  return NextResponse.json({ ok: true, note: { id: n.id, at: n.createdAt, by: n.authorName ?? n.authorWallet ?? "unknown", body: n.body } }, { status: 201 });
}

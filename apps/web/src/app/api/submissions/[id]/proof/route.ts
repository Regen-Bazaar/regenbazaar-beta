import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { impactSubmissions } from "@rb/db/schema";
import { getDb } from "../../../../../lib/db";
import { requireActor } from "../../../../../lib/validator-auth";
import { cleanPlaceNames, runProofFetch } from "../../../../../lib/review";

export const runtime = "nodejs";

// POST /api/submissions/<id>/proof — validators only: "Check again". Fetches the report's proof and photo links on
// the server (https only, private addresses blocked, time and size limits; see packages/pipeline/src/proof-check.ts),
// stores a snapshot hash, the page text and the automatic checks. The first check happens by itself when a validator
// opens the impact (POST /api/review/<id>/open). It never sets the proof level and never changes IV.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireActor(req);
  if ("response" in a) return a.response;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // no body: place names are optional
  }
  const db = await getDb();
  const [s] = await db.select({ id: impactSubmissions.id }).from(impactSubmissions).where(eq(impactSubmissions.id, id)).limit(1);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  let placeNames: string[] | undefined;
  if (Array.isArray(body.placeNames)) {
    placeNames = cleanPlaceNames(body.placeNames); // saved by the run itself, only when the check really starts
  }
  const run = await runProofFetch(db, id, a.actor, { manual: true, placeNames });
  if (run.reason === "no_links") return NextResponse.json({ error: "this report has no proof links" }, { status: 422 });
  if (run.reason === "limited") return NextResponse.json({ error: "too many proof checks, please try again later" }, { status: 429 });
  if (run.reason === "rejected") return NextResponse.json({ error: "this impact was rejected; its proof pages are not stored again" }, { status: 409 });
  if (run.reason === "already_running") return NextResponse.json({ error: "a check is already running for this impact" }, { status: 409 });
  if (!run.started) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ id, proofChecks: run.checks });
}

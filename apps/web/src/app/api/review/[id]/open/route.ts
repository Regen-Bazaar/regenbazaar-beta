import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { impactSubmissions } from "@rb/db/schema";
import { getDb } from "../../../../../lib/db";
import { requireActor } from "../../../../../lib/validator-auth";
import { markOpened, proofDeps, runProofFetch } from "../../../../../lib/review";

export const runtime = "nodejs";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/review/<id>/open — a validator opened the impact page: mark who has it open and start the automatic proof
// check once (links and photo links). The fetch runs in the background; the page polls for the result.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireActor(req);
  if ("response" in a) return a.response;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const db = await getDb();
  const [s] = await db.select({ id: impactSubmissions.id, status: impactSubmissions.status }).from(impactSubmissions).where(eq(impactSubmissions.id, id)).limit(1);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  await markOpened(db, id, a.actor);
  // Only impacts that are still waiting are fetched; decided ones are only read.
  let proof: string = "skipped";
  if (s.status === "pending_verification") {
    const run = runProofFetch(db, id, a.actor).catch((e) => {
      console.error("proof fetch failed", e instanceof Error ? e.message : e);
    });
    if (proofDeps.awaitOpenFetch) await run; // tests only
    proof = "started";
  }
  return NextResponse.json({ ok: true, proof });
}

import { NextResponse } from "next/server";
import { eq, isNotNull } from "drizzle-orm";
import { impactSubmissions, organizations } from "@rb/db/schema";
import {
  checkProofLink,
  createDeepSeekFactExtractor,
  llmConfigured,
  duplicateFlags,
  type ProofCheckResult,
} from "@rb/pipeline";
import type { ExtractedActionV02 } from "@rb/impact-engine";
import { getDb } from "../../../../../lib/db";
import { isAdmin } from "../../../../../lib/admin";
import { rateLimit } from "../../../../../lib/rate-limit";

export const runtime = "nodejs";

const CHECKS_PER_HOUR = 30;

// POST /api/submissions/<id>/proof — validators only. Fetches the report's proof links on the server
// (https only, private addresses blocked, time and size limits), stores a snapshot hash and AI/regex
// flags per link. It never sets the proof level and never changes IV: the validator decides.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) return NextResponse.json({ error: "validator access required" }, { status: 401 });
  if (!rateLimit("proof:all", CHECKS_PER_HOUR, 3_600_000)) {
    return NextResponse.json({ error: "too many proof checks, please try again later" }, { status: 429 });
  }
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    // no body: place names are optional
  }

  const db = await getDb();
  const [s] = await db.select().from(impactSubmissions).where(eq(impactSubmissions.id, id)).limit(1);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });
  const links = Array.isArray(s.proofLinks) ? (s.proofLinks as unknown[]).filter((u): u is string => typeof u === "string") : [];
  if (!links.length) return NextResponse.json({ error: "this report has no proof links" }, { status: 422 });

  const [org] = await db.select({ region: organizations.region }).from(organizations).where(eq(organizations.id, s.orgId)).limit(1);
  const typed = Array.isArray(body.placeNames)
    ? (body.placeNames as unknown[]).filter((p): p is string => typeof p === "string").map((p) => p.trim().slice(0, 80)).slice(0, 5)
    : [];
  const c = (s.context ?? {}) as { periodStart?: string; periodEnd?: string };
  const claim = {
    actions: ((s.extractedActions ?? []) as ExtractedActionV02[]).map((a) => ({ actionType: a.actionType, quantity: a.quantity, unit: a.unit })),
    periodStart: c.periodStart,
    periodEnd: c.periodEnd,
    placeNames: [...typed, ...(org?.region ? [org.region] : [])],
  };
  const factExtractor = llmConfigured() ? createDeepSeekFactExtractor() : undefined;

  const results: ProofCheckResult[] = [];
  for (const url of links) results.push(await checkProofLink(url, claim, { factExtractor }));

  // Same content already given as proof in another report.
  const others = await db
    .select({ id: impactSubmissions.id, checks: impactSubmissions.proofChecks })
    .from(impactSubmissions)
    .where(isNotNull(impactSubmissions.proofChecks))
    .limit(2000);
  const seen = others
    .filter((o) => o.id !== id && Array.isArray(o.checks))
    .flatMap((o) => (o.checks as ProofCheckResult[]).filter((r) => r.sha256).map((r) => ({ submissionId: o.id, sha256: r.sha256! })));
  const checked = duplicateFlags(results, seen);

  await db.update(impactSubmissions).set({ proofChecks: checked, updatedAt: new Date() }).where(eq(impactSubmissions.id, id));
  return NextResponse.json({ id, proofChecks: checked });
}

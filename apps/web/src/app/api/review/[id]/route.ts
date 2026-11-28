import { NextResponse } from "next/server";
import { asc, desc, eq } from "drizzle-orm";
import type { CostDeclaration } from "@rb/impact-engine";
import { actionLog, aiRuns, impactSubmissions, organizations, proofPages, reviewNotes, reviewState, users, verifications } from "@rb/db/schema";
import { getDb } from "../../../../lib/db";
import { requireActor } from "../../../../lib/validator-auth";
import { findDuplicates } from "../../../../lib/duplicates";
import { esmSuggestionFor } from "../../../../lib/esm-layers";
import { attentionMarks, consequenceLine, median } from "../../../../lib/review-marks";
import { creatorHistory, linksOf } from "../../../../lib/review";

export const runtime = "nodejs";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/review/<id> — validators and admins. Everything the impact page shows: the claim, the creator and their
// history, things to look at, stored proof pages, internal notes (never public), the timeline, the consequence line.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireActor(req);
  if ("response" in a) return a.response;
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const db = await getDb();
  const [r] = await db.select().from(impactSubmissions).where(eq(impactSubmissions.id, id)).limit(1);
  if (!r) return NextResponse.json({ error: "not found" }, { status: 404 });

  const [org] = await db
    .select({ id: organizations.id, name: organizations.name, wallet: organizations.walletAddress, verified: organizations.verified })
    .from(organizations)
    .where(eq(organizations.id, r.orgId))
    .limit(1);
  const all = await db
    .select({
      id: impactSubmissions.id,
      orgId: impactSubmissions.orgId,
      title: impactSubmissions.title,
      status: impactSubmissions.status,
      description: impactSubmissions.description,
      extractedActions: impactSubmissions.extractedActions,
      context: impactSubmissions.context,
      ivValue: impactSubmissions.ivValue,
    })
    .from(impactSubmissions)
    .orderBy(desc(impactSubmissions.createdAt))
    .limit(2000);
  const possibleDuplicates = findDuplicates({ ...r }, all);
  const history = await creatorHistory(db, r.orgId, id);
  const [state] = await db.select().from(reviewState).where(eq(reviewState.submissionId, id)).limit(1);
  const pages = await db.select().from(proofPages).where(eq(proofPages.submissionId, id)).orderBy(asc(proofPages.kind), asc(proofPages.url));
  const notes = await db.select().from(reviewNotes).where(eq(reviewNotes.submissionId, id)).orderBy(asc(reviewNotes.createdAt));
  const runs = await db
    .select({ id: aiRuns.id, createdAt: aiRuns.createdAt, job: aiRuns.job, provider: aiRuns.provider, model: aiRuns.model, instructionVersion: aiRuns.instructionVersion, inputTokens: aiRuns.inputTokens, outputTokens: aiRuns.outputTokens, durationMs: aiRuns.durationMs, ok: aiRuns.ok, error: aiRuns.error })
    .from(aiRuns)
    .where(eq(aiRuns.submissionId, id))
    .orderBy(asc(aiRuns.createdAt));
  const decisions = await db
    .select({ id: verifications.id, decision: verifications.decision, note: verifications.note, createdAt: verifications.createdAt, name: users.displayName, wallet: users.walletAddress })
    .from(verifications)
    .leftJoin(users, eq(verifications.validatorId, users.id))
    .where(eq(verifications.submissionId, id))
    .orderBy(asc(verifications.createdAt));
  const log = await db.select().from(actionLog).where(eq(actionLog.objectId, id)).orderBy(asc(actionLog.createdAt)).limit(300);

  const links = linksOf(r);
  const ctx2 = (r.context ?? {}) as { cost?: CostDeclaration; country?: string };
  const lastRequest = [...decisions].reverse().find((d) => d.decision === "request_info") ?? null;
  const marks = attentionMarks({
    history: history.summary,
    ivValue: Number(r.ivValue ?? 0) || 0,
    ivMedianOthers: median(all.filter((x) => x.id !== id).map((x) => Number(x.ivValue ?? 0))),
    duplicates: possibleDuplicates.length,
    links: [...links.proof, ...links.photo.filter((u) => !links.proof.includes(u))],
    checks: Array.isArray(r.proofChecks) ? (r.proofChecks as never) : null,
    checking: state?.proofStatus === "running",
    cost: ctx2.cost,
    country: ctx2.country,
    hasCoordinates: !!r.location,
    proofLinkCount: links.proof.length,
    lastRequestAt: lastRequest?.createdAt.toISOString() ?? null,
  });

  // Timeline: log lines of this impact (all validators), internal notes, the creator's submission, and decisions
  // that predate the log (no log line within 10 s of them).
  const decisionLog = log.filter((l) => l.action === "approve" || l.action === "reject" || l.action === "request_info");
  const events = [
    { at: r.createdAt, kind: "submitted" as const, title: "Submitted", detail: "", by: org?.name ?? null },
    ...log
      .filter((l) => l.action !== "add_note")
      .map((l) => ({ at: l.createdAt, kind: "log" as const, line: { action: l.action, before: l.before, after: l.after, note: l.note, result: l.result, error: l.error }, by: l.actorName ?? l.actorWallet ?? "unknown" })),
    ...notes.map((n) => ({ at: n.createdAt, kind: "note" as const, title: "Internal note", detail: n.body, by: n.authorName ?? n.authorWallet ?? "unknown" })),
    ...decisions
      .filter((d) => !decisionLog.some((l) => l.action === d.decision && Math.abs(l.createdAt.getTime() - d.createdAt.getTime()) < 10_000))
      .map((d) => ({
        at: d.createdAt,
        kind: "log" as const,
        line: { action: d.decision, before: null, after: null, note: d.note, result: "done", error: null },
        by: d.name ?? d.wallet ?? "shared access code (before personal accounts)",
      })),
  ].sort((x, y) => x.at.getTime() - y.at.getTime());

  const esmSuggestion = r.methodologyVersion === "v0.2" ? await esmSuggestionFor(r.location) : null;
  const prices = r.methodologyVersion === "v0.2" ? consequenceLine(Number(r.ivValue ?? 0) || 0, ctx2.cost) : [];

  return NextResponse.json({
    submission: { ...r, org: org ?? null, possibleDuplicates, esmSuggestion },
    history,
    marks,
    state: state
      ? { state: state.state, openedBy: state.openedByName, openedAt: state.openedAt, placeNames: state.placeNames, proofStatus: state.proofStatus }
      : { state: "waiting", openedBy: null, openedAt: null, placeNames: [], proofStatus: "none" },
    proofPages: pages.map((p) => ({
      kind: p.kind, url: p.url, finalUrl: p.finalUrl, fetchedAt: p.fetchedAt, httpStatus: p.httpStatus, contentType: p.contentType,
      sha256: p.sha256, bytes: p.bytes, truncated: p.truncated, reader: p.reader, error: p.error, text: p.pageText,
    })),
    notes: notes.map((n) => ({ id: n.id, at: n.createdAt, by: n.authorName ?? n.authorWallet ?? "unknown", body: n.body })),
    timeline: events,
    consequence: prices,
    aiRuns: runs,
    decisions: decisions.map((d) => ({ id: d.id, decision: d.decision, note: d.note, at: d.createdAt, by: d.name ?? d.wallet ?? null })),
    role: a.actor.role,
  });
}

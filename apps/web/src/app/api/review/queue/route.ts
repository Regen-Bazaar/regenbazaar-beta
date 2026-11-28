import { NextResponse } from "next/server";
import { desc, eq, inArray } from "drizzle-orm";
import type { CostDeclaration } from "@rb/impact-engine";
import { impactSubmissions, organizations, reviewState, users, verifications } from "@rb/db/schema";
import { getDb } from "../../../../lib/db";
import { requireActor } from "../../../../lib/validator-auth";
import { findDuplicates } from "../../../../lib/duplicates";
import { attentionMarks, consequenceLine, median, summarizeHistory, type CreatorHistorySummary } from "../../../../lib/review-marks";
import { linksOf } from "../../../../lib/review";

export const runtime = "nodejs";

const LIMIT = 200;
const DECIDED = ["verified", "tokenized", "rejected"] as const;

// GET /api/review/queue?tab=waiting|decided&scope=mine|all — validators and admins. The impact list for the workspace:
// who, when, how big, what to look at, who has it open. No creator text is sent here; the impact page loads it.
export async function GET(req: Request) {
  const a = await requireActor(req);
  if ("response" in a) return a.response;
  const q = new URL(req.url).searchParams;
  const tab = q.get("tab") === "decided" ? "decided" : "waiting";
  const mine = q.get("scope") === "mine";
  const db = await getDb();

  // Everything submitted, with only the columns the rules need (duplicates, history, medians).
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

  let rows: (typeof impactSubmissions.$inferSelect)[];
  const decisionOf = new Map<string, { decision: string; at: Date; by: string | null; validatorId: string | null }>();
  if (tab === "waiting") {
    rows = await db.select().from(impactSubmissions).where(eq(impactSubmissions.status, "pending_verification")).orderBy(impactSubmissions.createdAt).limit(LIMIT);
  } else {
    const ds = await db
      .select({ submissionId: verifications.submissionId, decision: verifications.decision, at: verifications.createdAt, validatorId: verifications.validatorId, name: users.displayName, wallet: users.walletAddress })
      .from(verifications)
      .leftJoin(users, eq(verifications.validatorId, users.id))
      .orderBy(desc(verifications.createdAt))
      .limit(5000);
    for (const d of ds) if (!decisionOf.has(d.submissionId)) decisionOf.set(d.submissionId, { decision: d.decision, at: d.at, validatorId: d.validatorId, by: d.name ?? (d.wallet ? d.wallet.slice(0, 8) : null) });
    const ids = [...decisionOf.entries()]
      .filter(([, d]) => d.decision !== "request_info")
      .filter(([, d]) => !mine || (a.actor.userId ? d.validatorId === a.actor.userId : d.validatorId === null))
      .map(([id]) => id);
    rows = ids.length ? await db.select().from(impactSubmissions).where(inArray(impactSubmissions.id, ids)) : [];
    rows = rows.filter((r) => (DECIDED as readonly string[]).includes(r.status)).sort((x, y) => (decisionOf.get(y.id)!.at.getTime() - decisionOf.get(x.id)!.at.getTime())).slice(0, LIMIT);
  }
  const rowIds = rows.map((r) => r.id);
  const orgIds = [...new Set(rows.map((r) => r.orgId))];
  const orgs = orgIds.length
    ? await db.select({ id: organizations.id, name: organizations.name, wallet: organizations.walletAddress, verified: organizations.verified }).from(organizations).where(inArray(organizations.id, orgIds))
    : [];
  const orgById = new Map(orgs.map((o) => [o.id, o]));
  const states = rowIds.length ? await db.select().from(reviewState).where(inArray(reviewState.submissionId, rowIds)) : [];
  const stateById = new Map(states.map((s) => [s.submissionId, s]));
  const lastRequest = new Map<string, Date>();
  const requestRows = rowIds.length ? await db.select().from(verifications).where(inArray(verifications.submissionId, rowIds)).orderBy(desc(verifications.createdAt)) : [];
  for (const v of requestRows) if (v.decision === "request_info" && !lastRequest.has(v.submissionId)) lastRequest.set(v.submissionId, v.createdAt);

  const historyOf = (orgId: string, exceptId: string): CreatorHistorySummary =>
    summarizeHistory(all.filter((x) => x.orgId === orgId && x.id !== exceptId).map((x) => ({ status: x.status, withdrawn: false })));

  const out = rows.map((r) => {
    const history = historyOf(r.orgId, r.id);
    const iv = Number(r.ivValue ?? 0) || 0;
    const others = all.filter((x) => x.id !== r.id).map((x) => Number(x.ivValue ?? 0));
    const links = linksOf(r);
    const checks = Array.isArray(r.proofChecks) ? (r.proofChecks as { url: string; error?: string; flags: { severity: string }[] }[]) : null;
    const st = stateById.get(r.id);
    const ctx = (r.context ?? {}) as { cost?: CostDeclaration; country?: string };
    const dups = findDuplicates({ ...r }, all);
    const marks = attentionMarks({
      history,
      ivValue: iv,
      ivMedianOthers: median(others),
      duplicates: dups.length,
      links: [...links.proof, ...links.photo.filter((u) => !links.proof.includes(u))],
      checks,
      checking: st?.proofStatus === "running",
      cost: ctx.cost,
      country: ctx.country,
      hasCoordinates: !!r.location,
      proofLinkCount: links.proof.length,
      lastRequestAt: lastRequest.get(r.id)?.toISOString() ?? null,
    });
    const prices = r.methodologyVersion === "v0.2" ? consequenceLine(iv, ctx.cost) : [];
    const d = decisionOf.get(r.id);
    return {
      id: r.id,
      title: r.title,
      createdAt: r.createdAt,
      status: r.status,
      chainId: r.chainId,
      domain: r.domain,
      methodologyVersion: r.methodologyVersion,
      domainScores: r.domainScores,
      ivValue: r.ivValue,
      tablesVersion: r.tablesVersion,
      proofLevel: r.proofLevel,
      org: orgById.get(r.orgId) ?? null,
      history,
      marks,
      priceFromUsd: prices.length ? prices[0].totalUsd : null,
      priceToUsd: prices.length ? prices[prices.length - 1].totalUsd : null,
      openedBy: st?.openedByName ?? null,
      openedAt: st?.openedAt ?? null,
      proofStatus: st?.proofStatus ?? "none",
      decision: d ? { decision: d.decision, at: d.at, by: d.by } : null,
    };
  });
  return NextResponse.json({ tab, scope: mine ? "mine" : "all", rows: out });
}

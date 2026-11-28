// Validator workspace server logic (release 1): review state, proof fetch on first open, stored page text,
// place names, creator history. Every caller has already passed requireActor().
import { and, desc, eq, inArray, isNotNull, ne, or, sql } from "drizzle-orm";
import {
  impactSubmissions,
  listings,
  organizations,
  proofPages,
  reviewState,
  verifications,
} from "@rb/db/schema";
import type { DB } from "@rb/db";
import {
  checkProofLink,
  compareWithClaim,
  createDeepSeekFactExtractor,
  duplicateFlags,
  llmConfigured,
  type PageReading,
  type ProofCheckResult,
  type ProofClaim,
  type ProofFactExtractor,
} from "@rb/pipeline";
import type { ExtractedActionV02 } from "@rb/impact-engine";
import type { Actor } from "./validator-auth";
import { logAction } from "./action-log";
import { rateLimit } from "./rate-limit";
import { createRunRecorder } from "./ai-runs";
import { summarizeHistory, type CreatorHistorySummary } from "./review-marks";

export const CHECKS_PER_HOUR = 30; // the site-wide limit that already guarded the "Check links" button
export const LEASE_MS = 5 * 60_000; // a proof fetch that has not finished after this is taken over
export const MAX_PLACE_NAMES = 5;
export const MAX_NOTE_CHARS = 4000;

export type Sub = typeof impactSubmissions.$inferSelect;

/** Test seam: replace the page fetcher and the AI page reader. Production leaves it empty. */
export const proofDeps: {
  fetcher?: (url: string, opts: object) => Promise<import("@rb/pipeline").FetchedPage>;
  factExtractor?: ProofFactExtractor | null;
  awaitOpenFetch?: boolean; // the open route waits for the background fetch
} = {};

export const cleanPlaceNames = (raw: unknown): string[] =>
  Array.isArray(raw)
    ? [...new Set((raw as unknown[]).filter((p): p is string => typeof p === "string").map((p) => p.trim().slice(0, 80)).filter(Boolean))].slice(0, MAX_PLACE_NAMES)
    : [];

export const linksOf = (s: Pick<Sub, "proofLinks" | "mediaUris">) => ({
  proof: Array.isArray(s.proofLinks) ? (s.proofLinks as unknown[]).filter((u): u is string => typeof u === "string") : [],
  photo: Array.isArray(s.mediaUris) ? (s.mediaUris as unknown[]).filter((u): u is string => typeof u === "string") : [],
});

export async function ensureState(db: DB, id: string) {
  await db.insert(reviewState).values({ submissionId: id }).onConflictDoNothing();
  const [st] = await db.select().from(reviewState).where(eq(reviewState.submissionId, id)).limit(1);
  return st;
}

async function claimFor(db: DB, s: Sub, placeNames: string[]): Promise<ProofClaim> {
  const [org] = await db.select({ region: organizations.region }).from(organizations).where(eq(organizations.id, s.orgId)).limit(1);
  const c = (s.context ?? {}) as { periodStart?: string; periodEnd?: string };
  return {
    actions: ((s.extractedActions ?? []) as ExtractedActionV02[]).map((a) => ({ actionType: a.actionType, quantity: a.quantity, unit: a.unit })),
    periodStart: c.periodStart,
    periodEnd: c.periodEnd,
    placeNames: [...placeNames, ...(org?.region ? [org.region] : [])],
  };
}

export type ProofRun = { started: boolean; reason?: "already_running" | "done" | "no_links" | "limited" | "not_found"; checks?: ProofCheckResult[] };

/**
 * Fetches the impact's proof and photo links, stores the page text privately, writes the automatic checks.
 * auto = first open: runs once (a later open does not fetch again). Manual ("Check again") always runs.
 * The address guard in packages/pipeline/src/proof-check.ts is used as it is.
 */
export async function runProofFetch(db: DB, id: string, actor: Actor | null, opts: { manual?: boolean; placeNames?: string[] } = {}): Promise<ProofRun> {
  const [s] = await db.select().from(impactSubmissions).where(eq(impactSubmissions.id, id)).limit(1);
  if (!s) return { started: false, reason: "not_found" };
  const { proof, photo } = linksOf(s);
  if (!proof.length && !photo.length) return { started: false, reason: "no_links" };
  const before = await ensureState(db, id);
  const prevStatus = before.proofStatus === "done" ? "done" : "none";
  // Claim: only one fetch per impact at a time; auto-start only while nothing has been fetched.
  const lease = new Date(Date.now() - LEASE_MS);
  const claimable = opts.manual
    ? or(ne(reviewState.proofStatus, "running"), sql`${reviewState.proofStartedAt} < ${lease}`)
    : or(eq(reviewState.proofStatus, "none"), and(eq(reviewState.proofStatus, "running"), sql`${reviewState.proofStartedAt} < ${lease}`));
  const claimed = await db
    .update(reviewState)
    .set({ proofStatus: "running", proofStartedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(reviewState.submissionId, id), claimable))
    .returning({ placeNames: reviewState.placeNames });
  if (claimed.length === 0) {
    const [st] = await db.select().from(reviewState).where(eq(reviewState.submissionId, id)).limit(1);
    return { started: false, reason: st?.proofStatus === "running" ? "already_running" : "done" };
  }
  const release = (status: "none" | "done", finished = status === "done") =>
    db.update(reviewState).set({ proofStatus: status, ...(finished ? { proofFinishedAt: new Date() } : {}), updatedAt: new Date() }).where(eq(reviewState.submissionId, id));
  if (!rateLimit("proof:all", CHECKS_PER_HOUR, 3_600_000)) {
    await release(prevStatus, false);
    return { started: false, reason: "limited" };
  }
  try {
    const placeNames = opts.placeNames ?? cleanPlaceNames(claimed[0].placeNames);
    const claim = await claimFor(db, s, placeNames);
    const recorder = createRunRecorder();
    const factExtractor =
      proofDeps.factExtractor === undefined ? (llmConfigured() ? createDeepSeekFactExtractor({ onRun: recorder.onRun }) : undefined) : (proofDeps.factExtractor ?? undefined);
    const jobs = [...proof.map((url) => ({ url, kind: "proof" as const })), ...photo.filter((u) => !proof.includes(u)).map((url) => ({ url, kind: "photo" as const }))];
    const readings = new Map<string, PageReading>();
    const results = await Promise.all(
      jobs.map((j) =>
        checkProofLink(j.url, claim, {
          factExtractor,
          fetcher: proofDeps.fetcher,
          onPage: (p) => readings.set(j.url, p),
        }),
      ),
    );
    // Same content already given as proof in another report (this includes photo files).
    const others = await db
      .select({ id: impactSubmissions.id, checks: impactSubmissions.proofChecks })
      .from(impactSubmissions)
      .where(and(isNotNull(impactSubmissions.proofChecks), ne(impactSubmissions.id, id)))
      .limit(2000);
    const seen = others
      .filter((o) => Array.isArray(o.checks))
      .flatMap((o) => (o.checks as ProofCheckResult[]).filter((r) => r.sha256).map((r) => ({ submissionId: o.id, sha256: r.sha256! })));
    const checked = duplicateFlags(results, seen);
    await db.update(impactSubmissions).set({ proofChecks: checked, updatedAt: new Date() }).where(eq(impactSubmissions.id, id));
    for (const [i, j] of jobs.entries()) {
      const r = results[i];
      const reading = readings.get(j.url);
      const row = {
        submissionId: id,
        kind: j.kind,
        url: j.url,
        finalUrl: r.finalUrl?.slice(0, 2000) ?? null,
        fetchedAt: new Date(r.checkedAt),
        httpStatus: r.status ?? null,
        contentType: r.contentType?.slice(0, 100) ?? null,
        sha256: r.sha256 ?? null,
        bytes: r.bytes ?? null,
        truncated: r.truncated ?? false,
        pageText: reading?.text ?? null,
        facts: reading?.facts ?? null,
        reader: reading?.reader ?? "none",
        error: r.error ?? null,
      };
      await db.insert(proofPages).values(row).onConflictDoUpdate({ target: [proofPages.submissionId, proofPages.url], set: row });
    }
    await recorder.flush(db, id);
    await release("done");
    await logAction(db, actor, { action: "proof_check", objectType: "impact", objectId: id, after: { links: jobs.length, ...(opts.manual ? {} : { auto: true }) } });
    return { started: true, checks: checked };
  } catch (e) {
    await release(prevStatus, false).catch(() => {});
    throw e;
  }
}

/** Re-runs the rule comparison on the stored page text and facts with the current place names. No fetch, no AI. */
export async function recomputeFlags(db: DB, id: string, placeNames: string[]): Promise<void> {
  const [s] = await db.select().from(impactSubmissions).where(eq(impactSubmissions.id, id)).limit(1);
  if (!s || !Array.isArray(s.proofChecks)) return;
  const claim = await claimFor(db, s, placeNames);
  const pages = await db.select().from(proofPages).where(eq(proofPages.submissionId, id));
  const byUrl = new Map(pages.map((p) => [p.url, p]));
  const checks = (s.proofChecks as ProofCheckResult[]).map((r) => {
    const p = byUrl.get(r.url);
    if (!p || p.pageText === null || !p.facts) return r;
    const kept = r.flags.filter((f) => f.code === "duplicate_media");
    return { ...r, flags: [...compareWithClaim(p.facts as never, claim, p.pageText), ...kept] };
  });
  await db.update(impactSubmissions).set({ proofChecks: checks, updatedAt: new Date() }).where(eq(impactSubmissions.id, id));
}

/** Marks the impact as opened by this validator. Returns true when nobody had opened it before. */
export async function markOpened(db: DB, id: string, actor: Actor): Promise<boolean> {
  const st = await ensureState(db, id);
  const first = !st.openedAt;
  await db
    .update(reviewState)
    .set({ openedBy: actor.userId, openedByName: actor.name ?? (actor.via === "shared" ? "shared access code" : null), openedAt: new Date(), updatedAt: new Date() })
    .where(eq(reviewState.submissionId, id));
  if (first) await logAction(db, actor, { action: "open_impact", objectType: "impact", objectId: id });
  return first;
}

/** Creator's other impacts (same payout wallet), newest first, with the latest decision and a withdrawn flag. */
export async function creatorHistory(db: DB, orgId: string, exceptId: string) {
  const rows = await db
    .select({
      id: impactSubmissions.id,
      title: impactSubmissions.title,
      status: impactSubmissions.status,
      proofLevel: impactSubmissions.proofLevel,
      createdAt: impactSubmissions.createdAt,
    })
    .from(impactSubmissions)
    .where(and(eq(impactSubmissions.orgId, orgId), ne(impactSubmissions.id, exceptId)))
    .orderBy(desc(impactSubmissions.createdAt))
    .limit(50);
  const ids = rows.map((r) => r.id);
  const withdrawn = ids.length
    ? new Set((await db.select({ id: listings.submissionId }).from(listings).where(and(inArray(listings.submissionId, ids), isNotNull(listings.withdrawnAt)))).map((r) => r.id))
    : new Set<string>();
  const decisions = ids.length ? await db.select().from(verifications).where(inArray(verifications.submissionId, ids)).orderBy(desc(verifications.createdAt)) : [];
  const lastDecision = new Map<string, (typeof decisions)[number]>();
  for (const d of decisions) if (!lastDecision.has(d.submissionId)) lastDecision.set(d.submissionId, d);
  const items = rows.map((r) => ({ ...r, withdrawn: withdrawn.has(r.id), decision: lastDecision.get(r.id)?.decision ?? null, decidedAt: lastDecision.get(r.id)?.createdAt ?? null }));
  return { items, summary: summarizeHistory(items) as CreatorHistorySummary };
}

// Edition limit (site rule, owner decision 27.11.2026, contract-revision.md 5.5 point 1). The only bound on the
// loss if a false claim passes the gates: a new creator or a P1 impact sells at most LIMITED_EDITIONS until
// a validator confirms P2 or higher, OPEN_AFTER_DAYS pass after the first sale with no dispute, or an admin
// lifts it. Applies to revision 4 networks only. The numbers live here and nowhere else.
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { impactSubmissions, listings, withdrawalRequests } from "@rb/db/schema";
import type { DB } from "@rb/db";

export const EDITION_LIMIT = {
  limitedEditions: 25,
  openAfterDays: 30,
} as const;

const DAY_MS = 24 * 3600 * 1000;
type ProofLevel = string | null; // "P0".."P4", null = not graded (v0.1)

const confirmedProof = (p: ProofLevel) => p === "P2" || p === "P3" || p === "P4";

export interface LimitFacts {
  maxEditions: number;
  proofLevel: ProofLevel;
  creatorIsNew: boolean; // no confirmed impact yet
  firstSaleAt: Date | null;
  liftedAt: Date | null; // admin lift
  hasDispute: boolean; // an open or approved withdrawal request
  now: Date;
}

export type LimitState =
  | { limited: false; cap: number; of: number; why: "lifted_by_admin" | "proof_confirmed" | "not_limited" | "no_dispute_30_days" }
  | { limited: true; cap: number; of: number; why: "new_creator" | "proof_p1" };

export function editionLimit(f: LimitFacts): LimitState {
  const open = (why: "lifted_by_admin" | "proof_confirmed" | "not_limited" | "no_dispute_30_days") =>
    ({ limited: false, cap: f.maxEditions, of: f.maxEditions, why }) as const;
  if (f.liftedAt) return open("lifted_by_admin");
  if (confirmedProof(f.proofLevel)) return open("proof_confirmed");
  if (!f.creatorIsNew && f.proofLevel !== "P1") return open("not_limited");
  if (f.firstSaleAt && !f.hasDispute && f.now.getTime() - f.firstSaleAt.getTime() >= EDITION_LIMIT.openAfterDays * DAY_MS) {
    return open("no_dispute_30_days");
  }
  return {
    limited: true,
    cap: Math.min(EDITION_LIMIT.limitedEditions, f.maxEditions),
    of: f.maxEditions,
    why: f.proofLevel === "P1" ? "proof_p1" : "new_creator",
  };
}

/** Why `amount` more editions cannot be sold when `minted` are already out, or null when they can. */
export function editionLimitError(state: LimitState, minted: number, amount: number): string | null {
  if (minted + amount <= state.cap) return null;
  return state.limited
    ? `${state.cap} of ${state.of} editions are available now (new creator or proof P1); the rest opens after confirmation`
    : "no editions left";
}

/** Reads the facts for one listing from the database. */
export async function limitFactsFor(db: DB, listingId: string, now: Date): Promise<LimitFacts> {
  const [l] = await db
    .select({ id: listings.id, beneficiary: listings.beneficiary, maxEditions: listings.maxEditions, firstSaleAt: listings.firstSaleAt, liftedAt: listings.editionLimitLiftedAt, proofLevel: impactSubmissions.proofLevel })
    .from(listings)
    .innerJoin(impactSubmissions, eq(listings.submissionId, impactSubmissions.id))
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!l) throw new Error("listing not found");
  return {
    maxEditions: l.maxEditions,
    proofLevel: l.proofLevel,
    creatorIsNew: !(await creatorHasConfirmedImpact(db, l.beneficiary, l.id, now)),
    firstSaleAt: l.firstSaleAt,
    liftedAt: l.liftedAt,
    hasDispute: await hasDispute(db, l.id),
    now,
  };
}

async function hasDispute(db: DB, listingId: string): Promise<boolean> {
  const rows = await db
    .select({ id: withdrawalRequests.id })
    .from(withdrawalRequests)
    .where(and(eq(withdrawalRequests.listingId, listingId), inArray(withdrawalRequests.status, ["open", "approved"])))
    .limit(1);
  return rows.length > 0;
}

/**
 * A creator has a confirmed impact when another of their listings (same payout wallet), not withdrawn, has
 * proof P2+, an admin lift, or a first sale at least OPEN_AFTER_DAYS ago with no dispute.
 */
async function creatorHasConfirmedImpact(db: DB, wallet: string, exceptListingId: string, now: Date): Promise<boolean> {
  const others = await db
    .select({ id: listings.id, firstSaleAt: listings.firstSaleAt, liftedAt: listings.editionLimitLiftedAt, withdrawnAt: listings.withdrawnAt, proofLevel: impactSubmissions.proofLevel })
    .from(listings)
    .innerJoin(impactSubmissions, eq(listings.submissionId, impactSubmissions.id))
    .where(and(sql`lower(${listings.beneficiary}) = ${wallet.toLowerCase()}`, ne(listings.id, exceptListingId)));
  for (const o of others) {
    if (o.withdrawnAt) continue;
    if (o.liftedAt || confirmedProof(o.proofLevel)) return true;
    if (o.firstSaleAt && now.getTime() - o.firstSaleAt.getTime() >= EDITION_LIMIT.openAfterDays * DAY_MS && !(await hasDispute(db, o.id))) {
      return true;
    }
  }
  return false;
}

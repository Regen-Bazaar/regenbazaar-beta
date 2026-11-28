// Withdraw a false claim (owner decision 27.11.2026, contract-revision.md 5.5 point 2): a validator files a
// request with a reason; only an admin approves or rejects; every step goes to the action log. On approval the
// impact is marked withdrawn on TRWIV4 and its attestation is revoked in EAS, then the listing is closed.
// Revision 4 networks only: on today's contracts there is nothing on-chain to withdraw, so requests are refused.
import { and, desc, eq, inArray } from "drizzle-orm";
import { listings, withdrawalRequests } from "@rb/db/schema";
import type { DB } from "@rb/db";
import { logAction } from "./action-log";
import { networkByChainId, type Network } from "./networks";
import { contractGenerationOf } from "./revision4";
import { siteUrl } from "./site";
import type { Actor } from "./validator-auth";

type Hex = `0x${string}`;

export const REASON_MIN = 10;
export const REASON_MAX = 2000;

export interface ChainOps {
  withdraw(net: Network, easUid: Hex, reasonURI: string): Promise<Hex | null>;
  revoke(net: Network, easUid: Hex): Promise<Hex | null>; // null = already revoked
}

export type Result = { status: number; body: Record<string, unknown> };
const fail = (status: number, error: string): Result => ({ status, body: { error } });

type ListingRow = typeof listings.$inferSelect;

/** The revision 4 network a listing is sold on, or why it has none. */
function revision4Network(l: ListingRow, resolve: (chainId: number) => Network | undefined): Network | string {
  const net = resolve(l.chainId);
  if (!net) return "listing network not supported";
  if (contractGenerationOf(net) !== 4 || l.contractGeneration !== 4) {
    return `withdrawing a false claim is available on contract revision 4 only (${net.chain.name} is not switched yet)`;
  }
  return net;
}

export async function fileRequest(
  db: DB,
  actor: Actor,
  input: { listingId: unknown; reason: unknown },
  resolve: (chainId: number) => Network | undefined = networkByChainId,
): Promise<Result> {
  if (typeof input.listingId !== "string" || !/^[0-9a-f-]{36}$/i.test(input.listingId)) return fail(422, "listingId is required");
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (reason.length < REASON_MIN || reason.length > REASON_MAX) return fail(422, `reason must be ${REASON_MIN} to ${REASON_MAX} characters`);
  const [l] = await db.select().from(listings).where(eq(listings.id, input.listingId)).limit(1);
  if (!l) return fail(404, "listing not found");
  if (l.withdrawnAt) return fail(409, "already withdrawn");
  const net = revision4Network(l, resolve);
  if (typeof net === "string") return fail(409, net);
  const [open] = await db
    .select({ id: withdrawalRequests.id })
    .from(withdrawalRequests)
    .where(and(eq(withdrawalRequests.listingId, l.id), inArray(withdrawalRequests.status, ["open", "approving"])))
    .limit(1);
  if (open) return fail(409, "a withdrawal request for this listing is already open");
  let r: typeof withdrawalRequests.$inferSelect;
  try {
    [r] = await db
      .insert(withdrawalRequests)
      .values({ listingId: l.id, requestedBy: actor.userId, requestedWallet: actor.wallet, reason })
      .returning();
  } catch {
    // withdrawal_requests_one_open_idx: another validator filed at the same moment
    return fail(409, "a withdrawal request for this listing is already open");
  }
  await logAction(db, actor, { action: "withdraw_request", objectType: "listing", objectId: l.id, after: { requestId: r.id, status: "open" }, note: reason });
  return { status: 201, body: { ok: true, request: r } };
}

export async function decideRequest(
  db: DB,
  actor: Actor,
  requestId: string,
  input: { decision: unknown; note: unknown },
  chain: ChainOps,
  resolve: (chainId: number) => Network | undefined = networkByChainId,
): Promise<Result> {
  if (actor.role !== "admin") return fail(403, "admin role required"); // defence in depth; the route checks too
  const decision = input.decision;
  if (decision !== "approve" && decision !== "reject") return fail(422, "decision must be approve or reject");
  const note = typeof input.note === "string" ? input.note.slice(0, REASON_MAX) : null;
  const [r] = await db.select().from(withdrawalRequests).where(eq(withdrawalRequests.id, requestId)).limit(1);
  if (!r) return fail(404, "request not found");
  if (r.status !== "open" && !(decision === "approve" && r.status === "approving")) return fail(409, `request is already ${r.status}`);
  const [l] = await db.select().from(listings).where(eq(listings.id, r.listingId)).limit(1);
  if (!l) return fail(404, "listing not found");

  if (decision === "reject") {
    // Only an untouched request can be rejected: once approval started, the chain steps must be finished.
    const done = await db
      .update(withdrawalRequests)
      .set({ status: "rejected", decidedBy: actor.userId, decidedAt: new Date(), decisionNote: note })
      .where(and(eq(withdrawalRequests.id, r.id), eq(withdrawalRequests.status, "open")))
      .returning({ id: withdrawalRequests.id });
    if (done.length === 0) return fail(409, "request is no longer open");
    await logAction(db, actor, { action: "withdraw_reject", objectType: "listing", objectId: l.id, before: { requestId: r.id, status: "open" }, after: { status: "rejected" }, note });
    return { status: 200, body: { ok: true, status: "rejected" } };
  }

  const net = revision4Network(l, resolve);
  if (typeof net === "string") return fail(409, net);
  // Claim the request before any irreversible step; from here it can only end as approved.
  const claimed = await db
    .update(withdrawalRequests)
    .set({ status: "approving", decidedBy: actor.userId })
    .where(and(eq(withdrawalRequests.id, r.id), inArray(withdrawalRequests.status, ["open", "approving"])))
    .returning({ withdrawTx: withdrawalRequests.withdrawTx, revokeTx: withdrawalRequests.revokeTx });
  if (claimed.length === 0) return fail(409, "request is no longer open");
  const easUid = l.easUid as Hex;
  let withdrawTx: Hex | null = claimed[0].withdrawTx as Hex | null;
  let revokeTx: Hex | null = claimed[0].revokeTx as Hex | null;
  try {
    // On-chain first: the listing is only marked withdrawn once the token refuses the impact. Both steps skip
    // work already done on-chain ("0x" = it was already in place), so retries never repeat a transaction.
    if (!withdrawTx) {
      withdrawTx = (await chain.withdraw(net, easUid, siteUrl(`/submission/${l.submissionId}`))) ?? "0x";
      await db.update(withdrawalRequests).set({ withdrawTx }).where(eq(withdrawalRequests.id, r.id));
    }
    if (!revokeTx) {
      revokeTx = (await chain.revoke(net, easUid)) ?? "0x";
      await db.update(withdrawalRequests).set({ revokeTx }).where(eq(withdrawalRequests.id, r.id));
    }
  } catch (e) {
    const error = e instanceof Error ? e.message.slice(0, 300) : "on-chain step failed";
    await logAction(db, actor, { action: "withdraw_approve", objectType: "listing", objectId: l.id, before: { requestId: r.id }, after: { withdrawTx, revokeTx }, note, error });
    return fail(502, `withdrawal not finished, retry: ${error}`);
  }
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(withdrawalRequests)
      .set({ status: "approved", decidedBy: actor.userId, decidedAt: now, decisionNote: note, withdrawTx, revokeTx })
      .where(and(eq(withdrawalRequests.id, r.id), eq(withdrawalRequests.status, "approving")));
    await tx.update(listings).set({ withdrawnAt: now, withdrawnReason: r.reason, active: false }).where(eq(listings.id, l.id));
  });
  await logAction(db, actor, {
    action: "withdraw_approve",
    objectType: "listing",
    objectId: l.id,
    before: { requestId: r.id, active: l.active },
    after: { status: "approved", active: false, withdrawTx, revokeTx },
    note,
  });
  return { status: 200, body: { ok: true, status: "approved", withdrawTx, revokeTx } };
}

export async function listRequests(db: DB) {
  return db.select().from(withdrawalRequests).orderBy(desc(withdrawalRequests.createdAt)).limit(200);
}

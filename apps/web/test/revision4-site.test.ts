// Site rules for contract revision 4: validator wallet in the attestation, edition limit, withdraw flow.
// Real route handlers and an in-memory Postgres (PGlite); chain calls are replaced by fakes. No network.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createSiweMessage } from "viem/siwe";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { eq, sql } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
process.env.VALIDATOR_AUTH = "personal";
process.env.ADMIN_TOKEN = "shared-code-for-tests-0123456789";
process.env.OPERATOR_PRIVATE_KEY = generatePrivateKey(); // signs v2 vouchers locally; nothing is sent

const ORIGIN = "https://app.regenbazaar.com";
const HOST = "app.regenbazaar.com";
const DAY = 24 * 3600 * 1000;

const { getDb, getDemoOrgId } = await import("../src/lib/db");
const schema = await import("@rb/db/schema");
const { getNetwork } = await import("../src/lib/networks");
const { editionLimit, editionLimitError, limitFactsFor, EDITION_LIMIT } = await import("../src/lib/edition-limit");
const { attestationValidator, contractGenerationOf } = await import("../src/lib/revision4");
const { fileRequest, decideRequest } = await import("../src/lib/withdrawals");
const nonceRoute = await import("../src/app/api/auth/nonce/route");
const signInRoute = await import("../src/app/api/auth/sign-in/route");
const withdrawalsRoute = await import("../src/app/api/withdrawals/route");
const withdrawalRoute = await import("../src/app/api/withdrawals/[id]/route");
const liftRoute = await import("../src/app/api/listings/[id]/edition-limit/route");
const voucherRoute = await import("../src/app/api/listings/[id]/voucher/route");

const db = await getDb();
let ip = 0;
const ZERO_UUID = "00000000-0000-4000-8000-000000000000";

function req(url: string, o: { method?: string; cookie?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { "x-real-ip": `10.9.${Math.floor(++ip / 250)}.${ip % 250}` };
  if (o.body !== undefined) headers["content-type"] = "application/json";
  if (o.cookie) headers.cookie = o.cookie;
  if ((o.method ?? "GET") !== "GET") headers.origin = ORIGIN;
  return new Request(`${ORIGIN}${url}`, { method: o.method ?? "GET", headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(async () => {
  await db.execute(sql`delete from withdrawal_requests`);
  await db.execute(sql`update listings set edition_limit_lifted_by = null`);
  await db.execute(sql`delete from listings`);
  await db.execute(sql`delete from action_log`);
  await db.execute(sql`delete from validator_sessions`);
  await db.execute(sql`delete from auth_nonces`);
  await db.execute(sql`update verifications set validator_id = null`);
  await db.execute(sql`delete from users`);
});

async function addUser(role: "validator" | "admin") {
  const account = privateKeyToAccount(generatePrivateKey());
  const [u] = await db.insert(schema.users).values({ walletAddress: account.address.toLowerCase(), displayName: role, role }).returning();
  return { id: u.id, account, actor: { userId: u.id, wallet: u.walletAddress, name: role, role, via: "session" as const } };
}
async function signIn(account: ReturnType<typeof privateKeyToAccount>) {
  const nonce = ((await (await nonceRoute.POST(req("/api/auth/nonce", { method: "POST" }))).json()) as { nonce: string }).nonce;
  const now = new Date();
  const message = createSiweMessage({
    address: account.address, chainId: 421614, domain: HOST, nonce, uri: ORIGIN, version: "1",
    statement: "Sign in to Regen Bazaar as validator", issuedAt: now, expirationTime: new Date(now.getTime() + 300_000),
  });
  const res = await signInRoute.POST(req("/api/auth/sign-in", { method: "POST", body: { message, signature: await account.signMessage({ message }) } }));
  assert.equal(res.status, 200);
  return (res.headers.get("set-cookie") ?? "").split(";")[0];
}

const CREATOR = "0x" + "3".repeat(40);
async function insertListing(o: { generation?: number; proof?: string | null; beneficiary?: string; firstSaleAt?: Date | null; withdrawnAt?: Date | null; chainId?: number } = {}) {
  const [s] = await db
    .insert(schema.impactSubmissions)
    .values({ orgId: await getDemoOrgId(db), title: "Cleanup", description: "x", status: "tokenized", ivValue: "100", proofLevel: o.proof ?? null, methodologyVersion: "v0.2" })
    .returning();
  const [l] = await db
    .insert(schema.listings)
    .values({
      submissionId: s.id, chainId: o.chainId ?? 421614, tokenId: String(Math.floor(Math.random() * 1e9)), totalIvWei: "1", maxEditions: 100,
      pricePerEdition: "1000000", currency: "0xFFC95faa3d63Cde504a05B567C600B78C0b41892", beneficiary: o.beneficiary ?? CREATOR,
      easUid: "0x" + "4".repeat(64), metadataUri: "ipfs://x", contractGeneration: o.generation ?? 3, firstSaleAt: o.firstSaleAt ?? null,
      withdrawnAt: o.withdrawnAt ?? null,
    })
    .returning();
  return l;
}
const logLines = async (action: string) => (await db.select().from(schema.actionLog)).filter((r) => r.action === action);

// A revision 4 copy of Arbitrum Sepolia, for the library tests only (networks.ts keeps every network on 2).
const arbV2 = getNetwork("arbitrum-sepolia");
const arbV4 = { ...arbV2, primarySaleVersion: 3 as const };
const resolveV4 = (chainId: number) => (chainId === arbV4.chain.id ? arbV4 : undefined);

// ---- flag ---------------------------------------------------------------------------------------------------

test("flag: every enabled network is still on today's contracts", async () => {
  for (const key of ["arbitrum-sepolia", "robinhood-testnet", "celo-sepolia"] as const) {
    assert.equal(getNetwork(key).primarySaleVersion, 2, key);
    assert.equal(contractGenerationOf(getNetwork(key)), 3, key);
  }
  assert.equal(contractGenerationOf(arbV4), 4);
});

// ---- item 3: validator wallet in the attestation -----------------------------------------------------------

test("attestation: a signed-in validator's wallet is the validator reference; the shared code records zero", () => {
  const w = "0xAbCdEf0000000000000000000000000000000001";
  assert.equal(attestationValidator({ via: "session", wallet: w }), w.toLowerCase());
  assert.equal(attestationValidator({ via: "shared", wallet: null }), "0x0000000000000000000000000000000000000000");
  assert.equal(attestationValidator({ via: "session", wallet: null }), "0x0000000000000000000000000000000000000000");
  assert.equal(attestationValidator({ via: "session", wallet: "not-a-wallet" }), "0x0000000000000000000000000000000000000000");
});

// ---- item 4: edition limit -----------------------------------------------------------------------------------

const base = { maxEditions: 100, proofLevel: null as string | null, creatorIsNew: true, firstSaleAt: null as Date | null, liftedAt: null as Date | null, hasDispute: false, now: new Date("2026-12-10T00:00:00Z") };

test("limit: the numbers live in one place", () => {
  assert.deepEqual(EDITION_LIMIT, { limitedEditions: 25, openAfterDays: 30 });
});

test("limit: a new creator sells 25 of 100; the 26th edition is refused", () => {
  const s = editionLimit(base);
  assert.equal(s.limited, true);
  assert.equal(s.cap, 25);
  assert.equal(editionLimitError(s, 24, 1), null);
  assert.match(editionLimitError(s, 25, 1) ?? "", /25 of 100 editions are available now/);
  assert.notEqual(editionLimitError(s, 0, 26), null);
});

test("limit: proof P1 is limited even for a known creator", () => {
  const s = editionLimit({ ...base, creatorIsNew: false, proofLevel: "P1" });
  assert.deepEqual([s.limited, s.cap, s.why], [true, 25, "proof_p1"]);
});

test("limit: a known creator without P1 is not limited", () => {
  const s = editionLimit({ ...base, creatorIsNew: false, proofLevel: null });
  assert.deepEqual([s.limited, s.cap], [false, 100]);
  assert.equal(editionLimitError(s, 25, 1), null);
});

test("limit opens: a validator confirmed P2 or higher", () => {
  for (const p of ["P2", "P3", "P4"]) assert.equal(editionLimit({ ...base, proofLevel: p }).why, "proof_confirmed", p);
});

test("limit opens: 30 days after the first sale with no dispute, not a day earlier, not with a dispute", () => {
  const at = (days: number) => new Date(base.now.getTime() - days * DAY);
  assert.equal(editionLimit({ ...base, firstSaleAt: at(30) }).why, "no_dispute_30_days");
  assert.equal(editionLimit({ ...base, firstSaleAt: at(29) }).limited, true);
  assert.equal(editionLimit({ ...base, firstSaleAt: at(31), hasDispute: true }).limited, true);
  assert.equal(editionLimit({ ...base, firstSaleAt: null }).limited, true);
});

test("limit opens: an admin lifted it by hand", () => {
  assert.equal(editionLimit({ ...base, proofLevel: "P1", liftedAt: new Date() }).why, "lifted_by_admin");
});

test("limit facts: a creator is new until another of their impacts is confirmed; withdrawn or disputed ones do not count", async () => {
  const now = new Date();
  const target = await insertListing({ generation: 4 });
  assert.equal((await limitFactsFor(db, target.id, now)).creatorIsNew, true);

  const withdrawn = await insertListing({ generation: 4, proof: "P3", withdrawnAt: now });
  assert.equal((await limitFactsFor(db, target.id, now)).creatorIsNew, true, "withdrawn P3 does not count");

  const old = await insertListing({ generation: 4, firstSaleAt: new Date(now.getTime() - 31 * DAY) });
  await db.insert(schema.withdrawalRequests).values({ listingId: old.id, reason: "disputed photos" });
  assert.equal((await limitFactsFor(db, target.id, now)).creatorIsNew, true, "an open dispute keeps it unconfirmed");
  await db.update(schema.withdrawalRequests).set({ status: "rejected" }).where(eq(schema.withdrawalRequests.listingId, old.id));
  assert.equal((await limitFactsFor(db, target.id, now)).creatorIsNew, false, "31 days, no dispute: confirmed");

  const other = await insertListing({ generation: 4, beneficiary: "0x" + "5".repeat(40) });
  assert.equal((await limitFactsFor(db, other.id, now)).creatorIsNew, true, "another creator's impacts do not count");
  assert.ok(withdrawn.id);
});

test("limit facts: an open withdrawal request on the listing itself is a dispute", async () => {
  const l = await insertListing({ generation: 4 });
  assert.equal((await limitFactsFor(db, l.id, new Date())).hasDispute, false);
  await db.insert(schema.withdrawalRequests).values({ listingId: l.id, reason: "looks reused" });
  assert.equal((await limitFactsFor(db, l.id, new Date())).hasDispute, true);
});

test("lift: only an admin lifts the limit, with a note, and it is logged once", async () => {
  const v = await addUser("validator");
  const a = await addUser("admin");
  const l = await insertListing({ generation: 4 });
  const call = (cookie: string, body: unknown) => liftRoute.POST(req(`/api/listings/${l.id}/edition-limit`, { method: "POST", cookie, body }), params(l.id));
  assert.equal((await call(await signIn(v.account), { note: "company buys all" })).status, 403);
  const ac = await signIn(a.account);
  assert.equal((await call(ac, {})).status, 422);
  assert.equal((await call(ac, { note: "company buys all" })).status, 200);
  assert.equal((await call(ac, { note: "again" })).status, 200);
  const [row] = await db.select().from(schema.listings).where(eq(schema.listings.id, l.id));
  assert.ok(row.editionLimitLiftedAt);
  assert.equal(row.editionLimitLiftedBy, a.id);
  assert.equal((await logLines("edition_limit_lift")).length, 1);
});

// ---- voucher route: today's networks unchanged, generations never mixed ---------------------------------------

test("voucher: a listing on today's contracts still gets a v2 voucher (no limit applied)", async () => {
  const l = await insertListing({ generation: 3 });
  const res = await voucherRoute.GET(req(`/api/listings/${l.id}/voucher`), params(l.id));
  assert.equal(res.status, 200);
  const j = (await res.json()) as { version: number; voucher: Record<string, string> };
  assert.equal(j.version, 2);
  assert.equal(j.voucher.recipient, undefined);
});

test("voucher: a revision 4 listing is refused on a network still on today's contracts", async () => {
  const l = await insertListing({ generation: 4 });
  const res = await voucherRoute.GET(req(`/api/listings/${l.id}/voucher`), params(l.id));
  assert.equal(res.status, 409);
});

test("voucher: a withdrawn listing is refused", async () => {
  const l = await insertListing({ generation: 3, withdrawnAt: new Date() });
  assert.equal((await voucherRoute.GET(req(`/api/listings/${l.id}/voucher`), params(l.id))).status, 409);
});

// ---- item 5: withdraw flow -----------------------------------------------------------------------------------

function fakeChain(o: { failWithdraw?: boolean; failRevoke?: boolean } = {}) {
  const calls = { withdraw: 0, revoke: 0 };
  return {
    calls,
    ops: {
      withdraw: async () => {
        calls.withdraw++;
        if (o.failWithdraw) throw new Error("rpc down");
        return ("0x" + "a".repeat(64)) as `0x${string}`;
      },
      revoke: async () => {
        calls.revoke++;
        if (o.failRevoke) throw new Error("rpc down");
        return ("0x" + "b".repeat(64)) as `0x${string}`;
      },
    },
  };
}

test("withdraw routes: no session is refused; a reviewer cannot approve; everything is off on today's contracts", async () => {
  const v = await addUser("validator");
  const a = await addUser("admin");
  const l = await insertListing({ generation: 3 });
  assert.equal((await withdrawalsRoute.POST(req("/api/withdrawals", { method: "POST", body: { listingId: l.id, reason: "a false claim here" } }))).status, 401);
  assert.equal((await withdrawalsRoute.GET(req("/api/withdrawals"))).status, 401);
  const vc = await signIn(v.account);
  const filed = await withdrawalsRoute.POST(req("/api/withdrawals", { method: "POST", cookie: vc, body: { listingId: l.id, reason: "a false claim here" } }));
  assert.equal(filed.status, 409, "switched off on primarySaleVersion 2");
  const [r] = await db.insert(schema.withdrawalRequests).values({ listingId: l.id, reason: "a false claim here" }).returning();
  const decide = (cookie: string) => withdrawalRoute.POST(req(`/api/withdrawals/${r.id}`, { method: "POST", cookie, body: { decision: "approve" } }), params(r.id));
  assert.equal((await decide(vc)).status, 403, "a reviewer cannot approve");
  assert.equal((await decide(await signIn(a.account))).status, 409, "admin approve is off on today's contracts");
  const [still] = await db.select().from(schema.withdrawalRequests).where(eq(schema.withdrawalRequests.id, r.id));
  assert.equal(still.status, "open");
  const [listing] = await db.select().from(schema.listings).where(eq(schema.listings.id, l.id));
  assert.equal(listing.withdrawnAt, null);
  assert.equal(listing.active, true);
});

test("withdraw: a validator files a request with a reason; duplicates and short reasons are refused; it is logged", async () => {
  const v = await addUser("validator");
  const l = await insertListing({ generation: 4 });
  assert.equal((await fileRequest(db, v.actor, { listingId: l.id, reason: "short" }, resolveV4)).status, 422);
  assert.equal((await fileRequest(db, v.actor, { listingId: ZERO_UUID, reason: "a long enough reason" }, resolveV4)).status, 404);
  const ok = await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4);
  assert.equal(ok.status, 201);
  assert.equal((await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4)).status, 409);
  const [r] = await db.select().from(schema.withdrawalRequests);
  assert.deepEqual([r.requestedBy, r.requestedWallet, r.status], [v.id, v.actor.wallet, "open"]);
  const lines = await logLines("withdraw_request");
  assert.equal(lines.length, 1);
  assert.equal(lines[0].actorId, v.id);
});

test("withdraw: a listing on today's contracts cannot be withdrawn even on a revision 4 network", async () => {
  const v = await addUser("validator");
  const l = await insertListing({ generation: 3 });
  assert.equal((await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4)).status, 409);
});

test("withdraw: only an admin decides; reject closes the request and keeps the listing", async () => {
  const v = await addUser("validator");
  const a = await addUser("admin");
  const l = await insertListing({ generation: 4 });
  await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4);
  const [r] = await db.select().from(schema.withdrawalRequests);
  const chain = fakeChain();
  assert.equal((await decideRequest(db, v.actor, r.id, { decision: "approve", note: null }, chain.ops, resolveV4)).status, 403);
  assert.equal(chain.calls.withdraw, 0);
  const res = await decideRequest(db, a.actor, r.id, { decision: "reject", note: "evidence checks out" }, chain.ops, resolveV4);
  assert.equal(res.status, 200);
  const [after] = await db.select().from(schema.withdrawalRequests);
  assert.deepEqual([after.status, after.decidedBy], ["rejected", a.id]);
  const [listing] = await db.select().from(schema.listings).where(eq(schema.listings.id, l.id));
  assert.equal(listing.withdrawnAt, null);
  assert.equal(chain.calls.withdraw + chain.calls.revoke, 0);
  assert.equal((await logLines("withdraw_reject")).length, 1);
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, chain.ops, resolveV4)).status, 409, "decided once");
});

test("withdraw: admin approval withdraws on-chain, revokes, closes the listing and logs it", async () => {
  const v = await addUser("validator");
  const a = await addUser("admin");
  const l = await insertListing({ generation: 4 });
  await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4);
  const [r] = await db.select().from(schema.withdrawalRequests);
  const chain = fakeChain();
  const res = await decideRequest(db, a.actor, r.id, { decision: "approve", note: "confirmed with the creator" }, chain.ops, resolveV4);
  assert.equal(res.status, 200);
  assert.deepEqual(chain.calls, { withdraw: 1, revoke: 1 });
  const [after] = await db.select().from(schema.withdrawalRequests);
  assert.equal(after.status, "approved");
  assert.equal(after.withdrawTx, "0x" + "a".repeat(64));
  assert.equal(after.revokeTx, "0x" + "b".repeat(64));
  const [listing] = await db.select().from(schema.listings).where(eq(schema.listings.id, l.id));
  assert.ok(listing.withdrawnAt);
  assert.equal(listing.withdrawnReason, "photos are from another project");
  assert.equal(listing.active, false);
  const lines = await logLines("withdraw_approve");
  assert.equal(lines.length, 1);
  assert.equal(lines[0].result, "done");
  assert.equal((await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4)).status, 409, "already withdrawn");
});

test("withdraw: a failed on-chain step leaves the request open, logs the error, and a retry does not withdraw twice", async () => {
  const v = await addUser("validator");
  const a = await addUser("admin");
  const l = await insertListing({ generation: 4 });
  await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4);
  const [r] = await db.select().from(schema.withdrawalRequests);
  const broken = fakeChain({ failRevoke: true });
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, broken.ops, resolveV4)).status, 502);
  const [mid] = await db.select().from(schema.withdrawalRequests);
  assert.equal(mid.status, "open");
  assert.equal(mid.withdrawTx, "0x" + "a".repeat(64), "the done step is remembered");
  const [listing] = await db.select().from(schema.listings).where(eq(schema.listings.id, l.id));
  assert.equal(listing.withdrawnAt, null);
  const failed = await logLines("withdraw_approve");
  assert.equal(failed.length, 1);
  assert.equal(failed[0].result, "failed");

  const fixed = fakeChain();
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, fixed.ops, resolveV4)).status, 200);
  assert.deepEqual(fixed.calls, { withdraw: 0, revoke: 1 });
});

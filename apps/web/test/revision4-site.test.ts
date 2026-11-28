// Site rules for contract revision 4: validator wallet in the attestation, edition limit, withdraw flow.
// Real route handlers and an in-memory Postgres (PGlite); chain calls are replaced by fakes. No network.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createSiweMessage } from "viem/siwe";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { eq, sql } from "drizzle-orm";

delete process.env.DATABASE_URL; // never touch a configured database: the hooks below delete rows
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

type Hex = `0x${string}`;
/** Old-style fakes (send and confirm in one call) as the send/wait chain steps; every wait succeeds. */
function asOps(f: { withdraw: () => Promise<Hex | null>; revoke: () => Promise<Hex | null> }) {
  return { sendWithdraw: f.withdraw, sendRevoke: f.revoke, waitForTx: async () => "success" as const, isDone: async () => false };
}

function fakeChain(o: { failWithdraw?: boolean; failRevoke?: boolean } = {}) {
  const calls = { withdraw: 0, revoke: 0 };
  return {
    calls,
    ops: asOps({
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
    }),
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

test("withdraw: a failed on-chain step keeps the request claimed (not rejectable), logs the error, and a retry does not withdraw twice", async () => {
  const v = await addUser("validator");
  const a = await addUser("admin");
  const l = await insertListing({ generation: 4 });
  await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4);
  const [r] = await db.select().from(schema.withdrawalRequests);
  const broken = fakeChain({ failRevoke: true });
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, broken.ops, resolveV4)).status, 502);
  const [mid] = await db.select().from(schema.withdrawalRequests);
  assert.equal(mid.status, "approving");
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "reject", note: null }, broken.ops, resolveV4)).status, 409, "no reject once approval started");
  assert.equal((await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4)).status, 409, "no second request meanwhile");
  assert.equal(mid.withdrawTx, "0x" + "a".repeat(64), "the done step is remembered");
  const [listing] = await db.select().from(schema.listings).where(eq(schema.listings.id, l.id));
  assert.equal(listing.withdrawnAt, null);
  const failed = await logLines("withdraw_approve");
  assert.equal(failed.length, 1);
  assert.equal(failed[0].result, "failed");

  const fixed = fakeChain();
  // The revoke send threw, so it may have gone out: the claim is kept and an immediate retry is refused ...
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, fixed.ops, resolveV4)).status, 409);
  // ... and once the lease has run out, the retry finishes without repeating the withdraw.
  await db.update(schema.withdrawalRequests).set({ claimedAt: new Date(Date.now() - 11 * 60_000) }).where(eq(schema.withdrawalRequests.id, r.id));
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, fixed.ops, resolveV4)).status, 200);
  assert.deepEqual(fixed.calls, { withdraw: 0, revoke: 1 });
});

// ---- mintCap in the v3 voucher (owner decision 28.11.2026) ----------------------------------------------------

test("voucher v3: the mint cap must be present and between 1 and maxEditions", async () => {
  const { voucherV3Message } = await import("../src/lib/onchain");
  const v = {
    tokenId: 1n, creator: CREATOR as `0x${string}`, totalIV: 1n, maxEditions: 100n, pricePerEdition: 1n,
    currency: CREATOR as `0x${string}`, beneficiary: CREATOR as `0x${string}`, easUID: ("0x" + "4".repeat(64)) as `0x${string}`,
    metadataURI: "ipfs://x", royaltyBps: 250n, feeBps: 250n, partner: "0x0000000000000000000000000000000000000000" as `0x${string}`,
    partnerFeeBps: 0n, nonce: 0n, deadline: 1n, resaleFeeBps: 250n, resalePartnerBps: 0n,
  };
  assert.throws(() => voucherV3Message(v), /mint cap/);
  assert.throws(() => voucherV3Message({ ...v, mintCap: 0n }), /mint cap/);
  assert.throws(() => voucherV3Message({ ...v, mintCap: 101n }), /mint cap/);
  assert.equal(voucherV3Message({ ...v, mintCap: BigInt(EDITION_LIMIT.limitedEditions) }).mintCap, 25n);
  assert.equal(voucherV3Message({ ...v, mintCap: 100n }).mintCap, 100n);
});

// ---- several stablecoins per revision 4 network (owner decision 28.11.2026) ------------------------------------

test("currencies: revision 4 networks list their coins; today's networks keep their single sale currency", async () => {
  const { buyerCurrencies, findBuyerCurrency } = await import("../src/lib/networks");
  const arbUsdc = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
  assert.deepEqual(buyerCurrencies(arbV2).map((c) => c.address), [arbV2.saleCurrency.address], "v2: unchanged");
  assert.deepEqual(buyerCurrencies(arbV4).map((c) => c.symbol), ["USDC"]);
  assert.equal(findBuyerCurrency(arbV4, arbUsdc.toLowerCase())?.decimals, 6);
  assert.equal(findBuyerCurrency(arbV4, arbV2.saleCurrency.address), undefined, "USDG is not on the revision 4 list");
  assert.equal(findBuyerCurrency(arbV4, "0x0000000000000000000000000000000000000000"), undefined, "no native coin");
  const celo = getNetwork("celo-sepolia");
  const celoV4 = { ...celo, primarySaleVersion: 3 as const };
  assert.deepEqual(buyerCurrencies(celoV4).map((c) => [c.symbol, c.decimals]), [["USDC", 6], ["USDm (Celo dollar)", 18]]);
  assert.equal(findBuyerCurrency(celoV4, "0xEF4d55D6dE8e8d73232827Cd1e9b2F2dBb45bC80"), undefined, "cUSD is not on the list");
});

test("currencies: a USD price converts exactly into 6- and 18-decimal coins; fewer decimals are refused", async () => {
  const { usdToTokenUnits, USD_PRICE_DECIMALS, listingPriceUnit } = await import("../src/lib/networks");
  assert.equal(USD_PRICE_DECIMALS, 6);
  const price = 12_345_678n; // 12.345678 USD
  assert.equal(usdToTokenUnits(price, { decimals: 6 }), 12_345_678n);
  assert.equal(usdToTokenUnits(price, { decimals: 18 }), 12_345_678_000_000_000_000n);
  assert.throws(() => usdToTokenUnits(price, { decimals: 2 }), /decimals/);
  assert.deepEqual(listingPriceUnit(arbV2, 4), { decimals: 6, symbol: "USD" });
  assert.deepEqual(listingPriceUnit(arbV2, 3), { decimals: arbV2.saleCurrency.decimals, symbol: arbV2.saleCurrency.symbol });
});

test("voucher: a today's-network listing ignores ?currency and signs exactly as before", async () => {
  const l = await insertListing({ generation: 3 });
  const res = await voucherRoute.GET(req(`/api/listings/${l.id}/voucher?currency=0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d`), params(l.id));
  assert.equal(res.status, 200);
  const j = (await res.json()) as { version: number; voucher: Record<string, string> };
  assert.equal(j.version, 2);
  assert.equal(j.voucher.currency, l.currency);
  assert.equal(j.voucher.pricePerEdition, l.pricePerEdition);
});

test("withdraw: a retry skips a revocation that is already on-chain", async () => {
  const v = await addUser("validator");
  const a = await addUser("admin");
  const l = await insertListing({ generation: 4 });
  await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4);
  const [r] = await db.select().from(schema.withdrawalRequests);
  const calls = { revoke: 0 };
  const ops = asOps({
    withdraw: async () => null, // already withdrawn on-chain
    revoke: async () => {
      calls.revoke++;
      return null; // already revoked in EAS
    },
  });
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, ops, resolveV4)).status, 200);
  const [after] = await db.select().from(schema.withdrawalRequests);
  assert.deepEqual([after.status, after.withdrawTx, after.revokeTx], ["approved", "0x", "0x"]);
  const [listing] = await db.select().from(schema.listings).where(eq(schema.listings.id, l.id));
  assert.equal(listing.active, false);
  assert.equal(calls.revoke, 1);
});

test("withdraw: a reject that arrives after an approval does not overwrite it", async () => {
  const v = await addUser("validator");
  const a = await addUser("admin");
  const l = await insertListing({ generation: 4 });
  await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4);
  const [r] = await db.select().from(schema.withdrawalRequests);
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, fakeChain().ops, resolveV4)).status, 200);
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "reject", note: null }, fakeChain().ops, resolveV4)).status, 409);
  const [after] = await db.select().from(schema.withdrawalRequests);
  assert.equal(after.status, "approved");
});

test("onchain: a server with only the revision 4 signer key counts as configured", async () => {
  const { onchainEnabled } = await import("../src/lib/onchain");
  const op = process.env.OPERATOR_PRIVATE_KEY;
  delete process.env.OPERATOR_PRIVATE_KEY;
  try {
    assert.equal(onchainEnabled(), false);
    process.env.VOUCHER_SIGNER_PRIVATE_KEY = generatePrivateKey();
    assert.equal(onchainEnabled(), true);
  } finally {
    process.env.OPERATOR_PRIVATE_KEY = op;
    delete process.env.VOUCHER_SIGNER_PRIVATE_KEY;
  }
});

test("withdraw: two overlapping approvals send the chain steps once; the second is refused while the first runs", async () => {
  const v = await addUser("validator");
  const a = await addUser("admin");
  const b = await addUser("admin");
  const l = await insertListing({ generation: 4 });
  await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4);
  const [r] = await db.select().from(schema.withdrawalRequests);
  const calls = { withdraw: 0, revoke: 0 };
  let release!: () => void;
  const gate = new Promise<void>((res) => (release = res));
  const slow = asOps({
    withdraw: async () => {
      calls.withdraw++;
      await gate;
      return ("0x" + "a".repeat(64)) as `0x${string}`;
    },
    revoke: async () => {
      calls.revoke++;
      return ("0x" + "b".repeat(64)) as `0x${string}`;
    },
  });
  const first = decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, slow, resolveV4);
  await new Promise((res) => setTimeout(res, 20)); // the first attempt now holds the claim
  const second = await decideRequest(db, b.actor, r.id, { decision: "approve", note: null }, slow, resolveV4);
  assert.equal(second.status, 409);
  release();
  assert.equal((await first).status, 200);
  assert.deepEqual(calls, { withdraw: 1, revoke: 1 });
  const [after] = await db.select().from(schema.withdrawalRequests);
  assert.equal(after.status, "approved");
});

test("withdraw: an expired claim can be taken over, and the old holder cannot finalise", async () => {
  const v = await addUser("validator");
  const a = await addUser("admin");
  const l = await insertListing({ generation: 4 });
  await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4);
  const [r] = await db.select().from(schema.withdrawalRequests);
  // a crashed attempt left the claim 11 minutes ago
  await db
    .update(schema.withdrawalRequests)
    .set({ status: "approving", claimToken: "00000000-0000-4000-8000-0000000000aa", claimedAt: new Date(Date.now() - 11 * 60_000) })
    .where(eq(schema.withdrawalRequests.id, r.id));
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, fakeChain().ops, resolveV4)).status, 200);
});

test("withdraw: a receipt failure after sending keeps the hash; the retry only waits for it and sends nothing new", async () => {
  const v = await addUser("validator");
  const a = await addUser("admin");
  const l = await insertListing({ generation: 4 });
  await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4);
  const [r] = await db.select().from(schema.withdrawalRequests);
  const sent = { withdraw: 0, revoke: 0 };
  const waited: string[] = [];
  let rpcDown = true;
  const ops = {
    sendWithdraw: async () => {
      sent.withdraw++;
      return ("0x" + "a".repeat(64)) as Hex;
    },
    sendRevoke: async () => {
      sent.revoke++;
      return ("0x" + "b".repeat(64)) as Hex;
    },
    waitForTx: async (_n: unknown, h: Hex) => {
      waited.push(h);
      if (rpcDown) throw new Error("receipt timeout");
      return "success" as const;
    },
    isDone: async () => false,
  };
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, ops, resolveV4)).status, 502);
  const [mid] = await db.select().from(schema.withdrawalRequests);
  assert.equal(mid.withdrawTx, "0x" + "a".repeat(64), "the hash is saved before the receipt wait");
  rpcDown = false;
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, ops, resolveV4)).status, 200);
  assert.deepEqual(sent, { withdraw: 1, revoke: 1 }, "the retry did not send the withdraw again");
  assert.equal(waited.filter((h) => h === "0x" + "a".repeat(64)).length, 2);
});

test("withdraw: a reverted transaction is forgotten, so the next attempt sends it again", async () => {
  const v = await addUser("validator");
  const a = await addUser("admin");
  const l = await insertListing({ generation: 4 });
  await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4);
  const [r] = await db.select().from(schema.withdrawalRequests);
  let reverted = true;
  const sent = { withdraw: 0 };
  const ops = {
    sendWithdraw: async () => {
      sent.withdraw++;
      return ("0x" + "c".repeat(64)) as Hex;
    },
    sendRevoke: async () => ("0x" + "d".repeat(64)) as Hex,
    waitForTx: async () => (reverted ? ("reverted" as const) : ("success" as const)),
    isDone: async () => false, // the revert did not come from a finished step
  };
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, ops, resolveV4)).status, 502);
  const [mid] = await db.select().from(schema.withdrawalRequests);
  assert.equal(mid.withdrawTx, null, "the reverted hash is forgotten");
  assert.equal(sent.withdraw, 1, "no resend inside the same attempt");
  reverted = false;
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, ops, resolveV4)).status, 200);
  assert.equal(sent.withdraw, 2, "the retry sends it once");
});

test("withdraw: an attempt whose lease expired during a chain call stops after takeover and never reaches the next step", async () => {
  const v = await addUser("validator");
  const a = await addUser("admin");
  const b = await addUser("admin");
  const l = await insertListing({ generation: 4 });
  await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4);
  const [r] = await db.select().from(schema.withdrawalRequests);
  let release!: () => void;
  const gate = new Promise<void>((res) => (release = res));
  const firstCalls = { withdraw: 0, revoke: 0 };
  const stuck = {
    sendWithdraw: async () => {
      firstCalls.withdraw++;
      await gate; // a chain call that outlasts the lease
      return ("0x" + "e".repeat(64)) as Hex;
    },
    sendRevoke: async () => {
      firstCalls.revoke++;
      return ("0x" + "f".repeat(64)) as Hex;
    },
    waitForTx: async () => "success" as const,
    isDone: async () => false,
  };
  const first = decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, stuck, resolveV4);
  await new Promise((res) => setTimeout(res, 20));
  // the lease runs out while the first attempt is stuck, and a second admin takes over and finishes
  await db.update(schema.withdrawalRequests).set({ claimedAt: new Date(Date.now() - 11 * 60_000) }).where(eq(schema.withdrawalRequests.id, r.id));
  assert.equal((await decideRequest(db, b.actor, r.id, { decision: "approve", note: null }, fakeChain().ops, resolveV4)).status, 200);
  release();
  assert.equal((await first).status, 409, "the stale attempt is fenced off");
  assert.deepEqual(firstCalls, { withdraw: 1, revoke: 0 }, "it never sent the revoke");
  const [after] = await db.select().from(schema.withdrawalRequests);
  assert.deepEqual([after.status, after.decidedBy], ["approved", b.id]);
});

test("withdraw: takeover while a send is in flight: the duplicate reverts harmlessly and the request still ends approved once", async () => {
  const v = await addUser("validator");
  const a = await addUser("admin");
  const b = await addUser("admin");
  const l = await insertListing({ generation: 4 });
  await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4);
  const [r] = await db.select().from(schema.withdrawalRequests);
  // A tiny chain: the first withdraw that lands marks the impact; a later one reverts (AlreadyWithdrawn).
  const chainState = { withdrawn: false, revoked: false, sends: 0 };
  const hashes = new Map<string, "success" | "reverted">();
  let n = 0;
  const tx = (ok: boolean) => {
    const h = ("0x" + (++n).toString(16).padStart(64, "0")) as Hex;
    hashes.set(h, ok ? "success" : "reverted");
    return h;
  };
  let release!: () => void;
  const gate = new Promise<void>((res) => (release = res));
  let firstSend = true;
  const real = {
    sendWithdraw: async () => {
      if (chainState.withdrawn) return null;
      chainState.sends++;
      if (firstSend) {
        firstSend = false;
        await gate; // the first attempt stalls inside the send, before its hash is saved
        const ok = !chainState.withdrawn;
        chainState.withdrawn = true;
        return tx(ok);
      }
      chainState.withdrawn = true;
      return tx(true);
    },
    sendRevoke: async () => {
      if (chainState.revoked) return null;
      chainState.revoked = true;
      return tx(true);
    },
    waitForTx: async (_n: unknown, h: Hex) => hashes.get(h) ?? "reverted",
    isDone: async (_n: unknown, _u: unknown, step: "withdraw" | "revoke") => (step === "withdraw" ? chainState.withdrawn : chainState.revoked),
  };
  const first = decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, real, resolveV4);
  await new Promise((res) => setTimeout(res, 20));
  await db.update(schema.withdrawalRequests).set({ claimedAt: new Date(Date.now() - 11 * 60_000) }).where(eq(schema.withdrawalRequests.id, r.id));
  assert.equal((await decideRequest(db, b.actor, r.id, { decision: "approve", note: null }, real, resolveV4)).status, 200);
  release();
  assert.equal((await first).status, 409, "the stale attempt is fenced off after its send");
  assert.equal(chainState.sends, 2, "at most one duplicate send, which reverted on-chain");
  const [after] = await db.select().from(schema.withdrawalRequests);
  assert.deepEqual([after.status, after.decidedBy], ["approved", b.id]);
  assert.ok(chainState.withdrawn && chainState.revoked);
});

test("withdraw: a revert because the step was already done on-chain counts as done", async () => {
  const v = await addUser("validator");
  const a = await addUser("admin");
  const l = await insertListing({ generation: 4 });
  await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4);
  const [r] = await db.select().from(schema.withdrawalRequests);
  let withdrawn = false;
  const ops = {
    sendWithdraw: async () => {
      if (withdrawn) return null;
      withdrawn = true; // someone else's transaction lands first; ours reverts
      return ("0x" + "9".repeat(64)) as Hex;
    },
    sendRevoke: async () => ("0x" + "8".repeat(64)) as Hex,
    waitForTx: async (_n: unknown, h: Hex) => (h === "0x" + "9".repeat(64) ? ("reverted" as const) : ("success" as const)),
    isDone: async (_n: unknown, _u: unknown, step: "withdraw" | "revoke") => step === "withdraw" && withdrawn,
  };
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, ops, resolveV4)).status, 200);
  const [after] = await db.select().from(schema.withdrawalRequests);
  assert.deepEqual([after.status, after.withdrawTx], ["approved", "0x"]);
});

test("withdraw: if saving a sent transaction's hash fails, the claim is kept and an immediate retry is refused", async () => {
  const v = await addUser("validator");
  const a = await addUser("admin");
  const l = await insertListing({ generation: 4 });
  await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4);
  const [r] = await db.select().from(schema.withdrawalRequests);
  const sent = { withdraw: 0 };
  const ops = {
    sendWithdraw: async () => {
      sent.withdraw++;
      return ("0x" + "1".repeat(80)) as Hex; // longer than the column: the hash save fails after the send
    },
    sendRevoke: async () => ("0x" + "2".repeat(64)) as Hex,
    waitForTx: async () => "success" as const,
    isDone: async () => false,
  };
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, ops, resolveV4)).status, 502);
  const [mid] = await db.select().from(schema.withdrawalRequests);
  assert.equal(mid.status, "approving");
  assert.ok(mid.claimedAt, "the claim is still held");
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, ops, resolveV4)).status, 409, "no second send before the lease runs out");
  assert.equal(sent.withdraw, 1);
});

test("withdraw: after a revert the attempt never sends again; with an older transaction still pending, the chain decides", async () => {
  const v = await addUser("validator");
  const a = await addUser("admin");
  const l = await insertListing({ generation: 4 });
  await fileRequest(db, v.actor, { listingId: l.id, reason: "photos are from another project" }, resolveV4);
  const [r] = await db.select().from(schema.withdrawalRequests);
  // an older, unrecorded withdraw is still pending and lands while ours reverts behind it (same key, later nonce)
  let landed = false;
  const sent = { withdraw: 0 };
  const ops = {
    sendWithdraw: async () => {
      sent.withdraw++;
      return ("0x" + "7".repeat(64)) as Hex;
    },
    sendRevoke: async () => ("0x" + "6".repeat(64)) as Hex,
    waitForTx: async (_n: unknown, h: Hex) => {
      if (h === "0x" + "7".repeat(64)) {
        landed = true; // the pending one is mined first, so ours reverts as a duplicate
        return "reverted" as const;
      }
      return "success" as const;
    },
    isDone: async (_n: unknown, _u: unknown, step: "withdraw" | "revoke") => step === "withdraw" && landed,
  };
  assert.equal((await decideRequest(db, a.actor, r.id, { decision: "approve", note: null }, ops, resolveV4)).status, 200);
  assert.equal(sent.withdraw, 1, "no extra send after the revert");
  const [after] = await db.select().from(schema.withdrawalRequests);
  assert.deepEqual([after.status, after.withdrawTx], ["approved", "0x"]);
});

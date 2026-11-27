// Access rules for personal validator accounts (docs: validator-accounts.md, section 7).
// Runs the real route handlers against an in-memory Postgres (PGlite); no server, no network.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createSiweMessage } from "viem/siwe";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { eq, sql } from "drizzle-orm";

process.env.PGLITE_DIR = "memory://";
process.env.VALIDATOR_AUTH = "personal";
process.env.ADMIN_TOKEN = "shared-code-for-tests-0123456789";
process.env.IPFS_API_URL = "http://127.0.0.1:1";
delete process.env.OPERATOR_PRIVATE_KEY;

const ORIGIN = "https://app.regenbazaar.com";
const HOST = "app.regenbazaar.com";

const { getDb, getDemoOrgId } = await import("../src/lib/db");
const schema = await import("@rb/db/schema");
const { createFirstAdmin } = await import("@rb/db/first-admin");
const nonceRoute = await import("../src/app/api/auth/nonce/route");
const signInRoute = await import("../src/app/api/auth/sign-in/route");
const signOutRoute = await import("../src/app/api/auth/sign-out/route");
const meRoute = await import("../src/app/api/auth/me/route");
const submissionsRoute = await import("../src/app/api/submissions/route");
const metadataRoute = await import("../src/app/api/submissions/[id]/metadata/route");
const proofRoute = await import("../src/app/api/submissions/[id]/proof/route");
const verificationsRoute = await import("../src/app/api/verifications/route");
const partnersRoute = await import("../src/app/api/partners/route");
const partnerRoute = await import("../src/app/api/partners/[id]/route");
const listingPartnerRoute = await import("../src/app/api/listings/[id]/partner/route");
const validatorsRoute = await import("../src/app/api/validators/route");
const validatorRoute = await import("../src/app/api/validators/[id]/route");
const logRoute = await import("../src/app/api/action-log/route");

const db = await getDb();
let ipCounter = 0;
const ZERO_UUID = "00000000-0000-4000-8000-000000000000";

function req(url: string, o: { method?: string; cookie?: string; body?: unknown; origin?: string | null; headers?: Record<string, string> } = {}) {
  const headers: Record<string, string> = { ...o.headers };
  ipCounter += 1;
  headers["x-real-ip"] = `10.${Math.floor(ipCounter / 65000)}.${Math.floor(ipCounter / 250) % 250}.${ipCounter % 250}`; // distinct per request: the sign-in limiter is per address
  if (o.body !== undefined) headers["content-type"] = "application/json";
  if (o.cookie) headers.cookie = o.cookie;
  if (o.origin !== null && (o.method ?? "GET") !== "GET") headers.origin = o.origin ?? ORIGIN;
  return new Request(`${ORIGIN}${url}`, { method: o.method ?? "GET", headers, body: o.body === undefined ? undefined : JSON.stringify(o.body) });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const cookieOf = (res: Response) => (res.headers.get("set-cookie") ?? "").split(";")[0];

async function wipe() {
  await db.execute(sql`delete from action_log`);
  await db.execute(sql`delete from validator_sessions`);
  await db.execute(sql`delete from auth_nonces`);
  await db.execute(sql`update verifications set validator_id = null`);
  await db.execute(sql`delete from users`);
}
beforeEach(wipe);

async function addUser(role: "validator" | "admin", name: string = role, wallet = privateKeyToAccount(generatePrivateKey())) {
  const [u] = await db.insert(schema.users).values({ walletAddress: wallet.address.toLowerCase(), displayName: name, role }).returning();
  return { id: u.id, account: wallet };
}

async function getNonce() {
  return ((await (await nonceRoute.POST(req("/api/auth/nonce", { method: "POST" }))).json()) as { nonce: string }).nonce;
}
async function messageFor(account: ReturnType<typeof privateKeyToAccount>, o: { nonce?: string; domain?: string; expiresInMs?: number; statement?: string } = {}) {
  const now = new Date();
  return createSiweMessage({
    address: account.address,
    chainId: 421614,
    domain: o.domain ?? HOST,
    nonce: o.nonce ?? (await getNonce()),
    uri: ORIGIN,
    version: "1",
    statement: o.statement ?? "Sign in to Regen Bazaar as validator",
    issuedAt: now,
    expirationTime: new Date(now.getTime() + (o.expiresInMs ?? 300_000)),
  });
}
async function signInWith(account: ReturnType<typeof privateKeyToAccount>, message: string, signature?: string) {
  const sig = signature ?? (await account.signMessage({ message }));
  return signInRoute.POST(req("/api/auth/sign-in", { method: "POST", body: { message, signature: sig } }));
}
async function signIn(u: { account: ReturnType<typeof privateKeyToAccount> }) {
  const res = await signInWith(u.account, await messageFor(u.account));
  assert.equal(res.status, 200);
  return cookieOf(res);
}
const logLines = async (action?: string) => {
  const rows = await db.select().from(schema.actionLog);
  return action ? rows.filter((r) => r.action === action) : rows;
};

async function pendingSubmission() {
  const [s] = await db
    .insert(schema.impactSubmissions)
    .values({ orgId: await getDemoOrgId(db), title: "Test cleanup", description: "x", status: "pending_verification", ivValue: "100" })
    .returning();
  return s.id;
}

// ---- sign-in ------------------------------------------------------------------------------------------------

test("sign-in: active validator gets a session and /me shows the account", async () => {
  const v = await addUser("validator", "Vera");
  const cookie = await signIn(v);
  assert.match(cookie, /^rb_session=[0-9a-f]{64}$/);
  const me = (await (await meRoute.GET(req("/api/auth/me", { cookie }))).json()) as { mode: string; user: { role: string; name: string } };
  assert.deepEqual([me.mode, me.user.role, me.user.name], ["personal", "validator", "Vera"]);
  assert.equal((await logLines("sign_in")).length, 1);
});

test("sign-in: cookie is HttpOnly, SameSite=Strict and only a fingerprint is stored", async () => {
  const v = await addUser("validator");
  const res = await signInWith(v.account, await messageFor(v.account));
  const header = res.headers.get("set-cookie") ?? "";
  assert.match(header, /HttpOnly/);
  assert.match(header, /SameSite=Strict/);
  assert.match(header, /Secure/);
  const token = cookieOf(res).split("=")[1];
  const rows = await db.select().from(schema.validatorSessions);
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].tokenHash, token);
  assert.equal(rows[0].tokenHash.length, 64);
});

test("sign-in: a valid signature from an unknown wallet is refused and logged", async () => {
  const stranger = privateKeyToAccount(generatePrivateKey());
  const res = await signInWith(stranger, await messageFor(stranger));
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("set-cookie"), null);
  assert.equal((await db.select().from(schema.validatorSessions)).length, 0);
  assert.equal((await logLines("sign_in_refused")).length, 1);
});

test("sign-in: a signature for another site address is refused", async () => {
  const v = await addUser("validator");
  const res = await signInWith(v.account, await messageFor(v.account, { domain: "evil.example" }));
  assert.equal(res.status, 401);
});

test("sign-in: a one-time number cannot be used twice (replay)", async () => {
  const v = await addUser("validator");
  const message = await messageFor(v.account);
  const signature = await v.account.signMessage({ message });
  assert.equal((await signInWith(v.account, message, signature)).status, 200);
  assert.equal((await signInWith(v.account, message, signature)).status, 401);
});

test("sign-in: an expired one-time number is refused", async () => {
  const v = await addUser("validator");
  const nonce = await getNonce();
  await db.execute(sql`update auth_nonces set created_at = now() - interval '6 minutes'`);
  assert.equal((await signInWith(v.account, await messageFor(v.account, { nonce }))).status, 401);
});

test("sign-in: a message whose own expiry has passed is refused", async () => {
  const v = await addUser("validator");
  assert.equal((await signInWith(v.account, await messageFor(v.account, { expiresInMs: -1000 }))).status, 401);
});

test("sign-in: an unknown one-time number is refused", async () => {
  const v = await addUser("validator");
  assert.equal((await signInWith(v.account, await messageFor(v.account, { nonce: "deadbeefdeadbeef" }))).status, 401);
});

test("sign-in: a changed message or another signer's signature is refused", async () => {
  const v = await addUser("validator");
  const other = privateKeyToAccount(generatePrivateKey());
  const message = await messageFor(v.account);
  const signature = await v.account.signMessage({ message });
  assert.equal((await signInWith(v.account, message.replace("validator", "validators"), signature)).status, 401);
  assert.equal((await signInWith(v.account, await messageFor(v.account), await other.signMessage({ message }))).status, 401);
  assert.equal((await signInWith(v.account, `${message}\nResources:\n- https://evil.example`, signature)).status, 401);
});

test("sign-in: another statement is refused", async () => {
  const v = await addUser("validator");
  assert.equal((await signInWith(v.account, await messageFor(v.account, { statement: "Approve spending" }))).status, 401);
});

test("sign-in: wallet addresses are compared in lower case; the same wallet cannot appear twice", async () => {
  const admin = await addUser("admin");
  const adminCookie = await signIn(admin);
  const w = privateKeyToAccount(generatePrivateKey());
  const upper = `0x${w.address.slice(2).toUpperCase()}`;
  const add = await validatorsRoute.POST(req("/api/validators", { method: "POST", cookie: adminCookie, body: { wallet: upper, name: "Upper", role: "validator" } }));
  assert.equal(add.status, 201);
  const [row] = await db.select().from(schema.users).where(eq(schema.users.walletAddress, w.address.toLowerCase()));
  assert.equal(row.walletAddress, w.address.toLowerCase());
  const again = await validatorsRoute.POST(req("/api/validators", { method: "POST", cookie: adminCookie, body: { wallet: w.address, name: "Mixed", role: "validator" } }));
  assert.equal(again.status, 409);
  assert.equal((await signInWith(w, await messageFor(w))).status, 200); // checksum-case wallet signs in
});

test("sign-in: a cross-site sign-in request is refused", async () => {
  const v = await addUser("validator");
  const message = await messageFor(v.account);
  const res = await signInRoute.POST(req("/api/auth/sign-in", { method: "POST", origin: "https://evil.example", body: { message, signature: await v.account.signMessage({ message }) } }));
  assert.equal(res.status, 403);
});

test("sign-out ends the session", async () => {
  const v = await addUser("validator");
  const cookie = await signIn(v);
  assert.equal((await signOutRoute.POST(req("/api/auth/sign-out", { method: "POST", cookie }))).status, 200);
  assert.equal((await partnersRoute.GET(req("/api/partners", { cookie }))).status, 401);
  assert.equal((await logLines("sign_out")).length, 1);
});

// ---- no session / old code ---------------------------------------------------------------------------------

test("no session: every guarded entry point refuses; the old x-admin-token header is ignored", async () => {
  const subId = await pendingSubmission();
  const headerSets: Record<string, string>[] = [{}, { "x-admin-token": process.env.ADMIN_TOKEN! }];
  for (const headers of headerSets) {
    const calls: [string, Response][] = [
      ["GET submissions", await submissionsRoute.GET(req("/api/submissions?status=pending_verification", { headers }))],
      ["GET metadata", await metadataRoute.GET(req(`/api/submissions/${subId}/metadata`, { headers }), params(subId))],
      ["POST proof", await proofRoute.POST(req(`/api/submissions/${subId}/proof`, { method: "POST", headers, body: {} }), params(subId))],
      ["POST verifications", await verificationsRoute.POST(req("/api/verifications", { method: "POST", headers, body: { submissionId: subId, decision: "reject" } }))],
      ["GET partners", await partnersRoute.GET(req("/api/partners", { headers }))],
      ["POST partners", await partnersRoute.POST(req("/api/partners", { method: "POST", headers, body: { name: "P", payoutAddress: "0x" + "1".repeat(40), feeBps: 100 } }))],
      ["PATCH partner", await partnerRoute.PATCH(req(`/api/partners/${ZERO_UUID}`, { method: "PATCH", headers, body: { active: false } }), params(ZERO_UUID))],
      ["DELETE listing partner", await listingPartnerRoute.DELETE(req(`/api/listings/${ZERO_UUID}/partner`, { method: "DELETE", headers }), params(ZERO_UUID))],
      ["GET validators", await validatorsRoute.GET(req("/api/validators", { headers }))],
      ["POST validators", await validatorsRoute.POST(req("/api/validators", { method: "POST", headers, body: { wallet: "0x" + "2".repeat(40), name: "Eve", role: "admin" } }))],
      ["PATCH validator", await validatorRoute.PATCH(req(`/api/validators/${ZERO_UUID}`, { method: "PATCH", headers, body: { remove: true } }), params(ZERO_UUID))],
      ["GET action-log", await logRoute.GET(req("/api/action-log", { headers }))],
    ];
    for (const [name, res] of calls) {
      // metadata hides a non-public report as 404; all the others answer 401
      assert.equal(res.status, name === "GET metadata" ? 404 : 401, `${name} with ${JSON.stringify(headers)}`);
    }
  }
  assert.equal((await db.select().from(schema.verifications)).length, 0);
  assert.equal((await db.select().from(schema.partners)).length, 0);
  assert.equal((await db.select().from(schema.users)).length, 0);
});

test("public reads need no sign-in", async () => {
  const res = await submissionsRoute.GET(req("/api/submissions"));
  assert.equal(res.status, 200);
});

test("a session cookie is not accepted on a changing request from another site", async () => {
  const v = await addUser("validator");
  const cookie = await signIn(v);
  const subId = await pendingSubmission();
  const res = await verificationsRoute.POST(req("/api/verifications", { method: "POST", cookie, origin: "https://evil.example", body: { submissionId: subId, decision: "reject" } }));
  assert.equal(res.status, 401);
  const noOrigin = await verificationsRoute.POST(req("/api/verifications", { method: "POST", cookie, origin: null, body: { submissionId: subId, decision: "reject" } }));
  assert.equal(noOrigin.status, 401);
});

// ---- roles --------------------------------------------------------------------------------------------------

test("roles: a reviewer cannot do admin actions; an admin can", async () => {
  const rev = await addUser("validator", "Rita");
  const adm = await addUser("admin", "Adam");
  const rc = await signIn(rev);
  const ac = await signIn(adm);
  const partnerBody = { name: "Partner", payoutAddress: "0x" + "1".repeat(40), feeBps: 500 };

  assert.equal((await partnersRoute.POST(req("/api/partners", { method: "POST", cookie: rc, body: partnerBody }))).status, 403);
  const created = await partnersRoute.POST(req("/api/partners", { method: "POST", cookie: ac, body: partnerBody }));
  assert.equal(created.status, 201);
  const pid = ((await created.json()) as { id: string }).id;

  assert.equal((await partnerRoute.PATCH(req(`/api/partners/${pid}`, { method: "PATCH", cookie: rc, body: { active: false } }), params(pid))).status, 403);
  assert.equal((await partnerRoute.PATCH(req(`/api/partners/${pid}`, { method: "PATCH", cookie: ac, body: { active: false } }), params(pid))).status, 200);

  const listing = await insertListing(pid);
  assert.equal((await listingPartnerRoute.DELETE(req(`/api/listings/${listing}/partner`, { method: "DELETE", cookie: rc }), params(listing))).status, 403);
  assert.equal((await listingPartnerRoute.DELETE(req(`/api/listings/${listing}/partner`, { method: "DELETE", cookie: ac }), params(listing))).status, 200);

  const newWallet = privateKeyToAccount(generatePrivateKey()).address;
  const add = { wallet: newWallet, name: "Newcomer", role: "validator" };
  assert.equal((await validatorsRoute.POST(req("/api/validators", { method: "POST", cookie: rc, body: add }))).status, 403);
  assert.equal((await validatorsRoute.GET(req("/api/validators", { cookie: rc }))).status, 403);
  assert.equal((await validatorsRoute.POST(req("/api/validators", { method: "POST", cookie: ac, body: add }))).status, 201);
  assert.equal((await validatorRoute.PATCH(req(`/api/validators/${adm.id}`, { method: "PATCH", cookie: rc, body: { role: "validator" } }), params(adm.id))).status, 403);

  // a reviewer can read the partner list, run a review, and read only their own log lines
  assert.equal((await partnersRoute.GET(req("/api/partners", { cookie: rc }))).status, 200);
  const subId = await pendingSubmission();
  assert.equal((await verificationsRoute.POST(req("/api/verifications", { method: "POST", cookie: rc, body: { submissionId: subId, decision: "reject", note: "no proof" } }))).status, 200);
  const own = (await (await logRoute.GET(req("/api/action-log", { cookie: rc }))).json()) as { actorId: string }[];
  assert.ok(own.length > 0 && own.every((l) => l.actorId === rev.id));
  const all = (await (await logRoute.GET(req("/api/action-log", { cookie: ac }))).json()) as { actorId: string }[];
  assert.ok(new Set(all.map((l) => l.actorId)).size > 1);
  // a reviewer cannot read another person's lines by asking for them
  const asked = (await (await logRoute.GET(req(`/api/action-log?person=${adm.id}`, { cookie: rc }))).json()) as { actorId: string }[];
  assert.ok(asked.every((l) => l.actorId === rev.id));
});

async function insertListing(partnerId: string | null) {
  const subId = await pendingSubmission();
  const [l] = await db
    .insert(schema.listings)
    .values({
      submissionId: subId, chainId: 421614, tokenId: String(Math.floor(Math.random() * 1e9)), totalIvWei: "1", maxEditions: 100, pricePerEdition: "1",
      currency: "0x" + "0".repeat(40), beneficiary: "0x" + "3".repeat(40), easUid: "0x" + "4".repeat(64), metadataUri: "ipfs://x", partnerId,
    })
    .returning();
  return l.id;
}

// ---- removal ------------------------------------------------------------------------------------------------

test("removed validator: next request to every guarded entry point is refused, and signing in again is refused", async () => {
  const adm = await addUser("admin");
  const v = await addUser("validator", "Vic");
  const ac = await signIn(adm);
  const vc = await signIn(v);
  const subId = await pendingSubmission();
  const before = await partnersRoute.GET(req("/api/partners", { cookie: vc }));
  assert.equal(before.status, 200);

  const rm = await validatorRoute.PATCH(req(`/api/validators/${v.id}`, { method: "PATCH", cookie: ac, body: { remove: true } }), params(v.id));
  assert.equal(rm.status, 200);

  const after: [string, Response][] = [
    ["queue", await submissionsRoute.GET(req("/api/submissions?status=pending_verification", { cookie: vc }))],
    ["metadata", await metadataRoute.GET(req(`/api/submissions/${subId}/metadata`, { cookie: vc }), params(subId))],
    ["proof", await proofRoute.POST(req(`/api/submissions/${subId}/proof`, { method: "POST", cookie: vc, body: {} }), params(subId))],
    ["verifications", await verificationsRoute.POST(req("/api/verifications", { method: "POST", cookie: vc, body: { submissionId: subId, decision: "reject" } }))],
    ["partners", await partnersRoute.GET(req("/api/partners", { cookie: vc }))],
    ["log", await logRoute.GET(req("/api/action-log", { cookie: vc }))],
  ];
  for (const [name, res] of after) assert.equal(res.status, name === "metadata" ? 404 : 401, name);
  assert.equal((await meRoute.GET(req("/api/auth/me", { cookie: vc })).then((r) => r.json()) as { user: unknown }).user, null);
  assert.equal((await signInWith(v.account, await messageFor(v.account))).status, 401);

  const [row] = await db.select().from(schema.users).where(eq(schema.users.id, v.id));
  assert.equal(row.active, false);
  assert.ok(row.removedAt); // marked, never deleted
  assert.equal((await logLines("validator_remove")).length, 1);
});

test("removed validator can be added again and then signs in", async () => {
  const adm = await addUser("admin");
  const v = await addUser("validator");
  const ac = await signIn(adm);
  await validatorRoute.PATCH(req(`/api/validators/${v.id}`, { method: "PATCH", cookie: ac, body: { remove: true } }), params(v.id));
  const re = await validatorsRoute.POST(req("/api/validators", { method: "POST", cookie: ac, body: { wallet: v.account.address, name: "Back", role: "validator" } }));
  assert.equal(re.status, 201);
  assert.equal((await signInWith(v.account, await messageFor(v.account))).status, 200);
});

test("ending someone's sessions refuses their cookie but not their next sign-in", async () => {
  const adm = await addUser("admin");
  const v = await addUser("validator");
  const ac = await signIn(adm);
  const vc = await signIn(v);
  await validatorRoute.PATCH(req(`/api/validators/${v.id}`, { method: "PATCH", cookie: ac, body: { endSessions: true } }), params(v.id));
  assert.equal((await partnersRoute.GET(req("/api/partners", { cookie: vc }))).status, 401);
  assert.equal((await signInWith(v.account, await messageFor(v.account))).status, 200);
});

test("an expired session is refused", async () => {
  const v = await addUser("validator");
  const cookie = await signIn(v);
  await db.execute(sql`update validator_sessions set expires_at = now() - interval '1 minute'`);
  assert.equal((await partnersRoute.GET(req("/api/partners", { cookie }))).status, 401);
});

// ---- last admin ---------------------------------------------------------------------------------------------

test("last admin: cannot be removed or demoted; can be once a second admin exists", async () => {
  const a1 = await addUser("admin", "One");
  const c1 = await signIn(a1);
  const patch = (id: string, body: unknown) => validatorRoute.PATCH(req(`/api/validators/${id}`, { method: "PATCH", cookie: c1, body }), params(id));
  assert.equal((await patch(a1.id, { remove: true })).status, 409);
  assert.equal((await patch(a1.id, { role: "validator" })).status, 409);
  const [still] = await db.select().from(schema.users).where(eq(schema.users.id, a1.id));
  assert.equal([still.role, still.active].join(), "admin,true");
  const a2 = await addUser("admin", "Two");
  assert.equal((await patch(a2.id, { role: "validator" })).status, 200);
  assert.equal((await patch(a2.id, { role: "admin" })).status, 200);
  assert.equal((await patch(a1.id, { role: "validator" })).status, 200);
  // a1 is now a reviewer, so a2 is the last admin and cannot remove themselves
  const c2 = await signIn(a2);
  assert.equal((await validatorRoute.PATCH(req(`/api/validators/${a2.id}`, { method: "PATCH", cookie: c2, body: { remove: true } }), params(a2.id))).status, 409);
});

// ---- first admin --------------------------------------------------------------------------------------------

test("first admin: no route creates one without an admin session; the server command does, once, and logs it", async () => {
  const w = privateKeyToAccount(generatePrivateKey()).address;
  const body = { wallet: w, name: "Mallory", role: "admin" };
  assert.equal((await validatorsRoute.POST(req("/api/validators", { method: "POST", body }))).status, 401);
  const rev = await addUser("validator");
  assert.equal((await validatorsRoute.POST(req("/api/validators", { method: "POST", cookie: await signIn(rev), body }))).status, 403);
  assert.equal((await validatorsRoute.POST(req("/api/validators", { method: "POST", headers: { "x-admin-token": process.env.ADMIN_TOKEN! }, body }))).status, 401);
  assert.equal((await db.select().from(schema.users).where(eq(schema.users.walletAddress, w.toLowerCase()))).length, 0);

  await db.execute(sql`delete from validator_sessions`);
  await db.execute(sql`delete from action_log`);
  await db.execute(sql`delete from users`);
  const admin = await createFirstAdmin(db as never, w, "Paul");
  assert.equal(admin.role, "admin");
  assert.equal((await logLines("first_admin")).length, 1);
  await assert.rejects(() => createFirstAdmin(db as never, "0x" + "5".repeat(40), "Second"), /already exists/);
});

// ---- action log ---------------------------------------------------------------------------------------------

test("action log: approve, proof level, partner actions each write exactly one line with author, object and before/after", async () => {
  const adm = await addUser("admin", "Adam");
  const ac = await signIn(adm);
  const subId = await pendingSubmission();
  const res = await verificationsRoute.POST(req("/api/verifications", { method: "POST", cookie: ac, body: { submissionId: subId, decision: "approve", note: "looks right" } }));
  assert.equal(res.status, 200);
  const lines = await logLines("approve");
  assert.equal(lines.length, 1);
  assert.deepEqual([lines[0].actorId, lines[0].actorName, lines[0].objectType, lines[0].objectId, lines[0].note, lines[0].result], [adm.id, "Adam", "impact", subId, "looks right", "done"]);
  assert.equal(lines[0].actorWallet, adm.account.address.toLowerCase());
  assert.deepEqual(lines[0].before, { status: "pending_verification" });
  assert.equal((lines[0].after as { status: string }).status, "verified");
  const [decision] = await db.select().from(schema.verifications).where(eq(schema.verifications.submissionId, subId));
  assert.equal(decision.validatorId, adm.id); // the decision row now names the validator

  const created = await partnersRoute.POST(req("/api/partners", { method: "POST", cookie: ac, body: { name: "DeCleanup", payoutAddress: "0x" + "1".repeat(40), feeBps: 500 } }));
  const pid = ((await created.json()) as { id: string }).id;
  await partnerRoute.PATCH(req(`/api/partners/${pid}`, { method: "PATCH", cookie: ac, body: { active: false } }), params(pid));
  await partnerRoute.PATCH(req(`/api/partners/${pid}`, { method: "PATCH", cookie: ac, body: { active: true } }), params(pid));
  const listing = await insertListing(pid);
  await listingPartnerRoute.DELETE(req(`/api/listings/${listing}/partner`, { method: "DELETE", cookie: ac }), params(listing));
  await validatorsRoute.POST(req("/api/validators", { method: "POST", cookie: ac, body: { wallet: privateKeyToAccount(generatePrivateKey()).address, name: "Zed", role: "validator" } }));

  const count = async (a: string) => (await logLines(a)).length;
  for (const a of ["partner_create", "partner_pause", "partner_resume", "partner_detach", "validator_add"]) assert.equal(await count(a), 1, a);
  const pause = (await logLines("partner_pause"))[0];
  assert.deepEqual([pause.before, pause.after, pause.objectId], [{ active: true }, { active: false }, pid]);
  const detach = (await logLines("partner_detach"))[0];
  assert.deepEqual([detach.before, detach.objectId], [{ partnerId: pid }, listing]);
  const add = (await logLines("validator_add"))[0];
  assert.equal((add.after as { name: string }).name, "Zed");
});

test("action log: a v0.2 review logs proof level and ESM with before and after", async () => {
  const v = await addUser("validator");
  const vc = await signIn(v);
  const [s] = await db
    .insert(schema.impactSubmissions)
    .values({ orgId: await getDemoOrgId(db), title: "v02", description: "x", status: "pending_verification", ivValue: "100", methodologyVersion: "v0.2", extractedActions: [], context: {} })
    .returning();
  const res = await verificationsRoute.POST(req("/api/verifications", { method: "POST", cookie: vc, body: { submissionId: s.id, decision: "request_info", proofLevel: "P1", esm: 1.1 } }));
  assert.equal(res.status, 200);
  const pl = await logLines("set_proof_level");
  assert.equal(pl.length, 1);
  assert.deepEqual([pl[0].before, pl[0].after], [{ proofLevel: null }, { proofLevel: "P1" }]);
  assert.equal((await logLines("set_esm")).length, 1);
  assert.equal((await logLines("request_info")).length, 1);
});

test("action log: a failed approval writes one line with the error", async () => {
  const v = await addUser("validator");
  const vc = await signIn(v);
  const subId = await pendingSubmission();
  process.env.OPERATOR_PRIVATE_KEY = "0x" + "11".repeat(32); // on-chain path on; IPFS is unreachable, so listing fails
  try {
    const res = await verificationsRoute.POST(req("/api/verifications", { method: "POST", cookie: vc, body: { submissionId: subId, decision: "approve" } }));
    assert.equal(res.status, 502);
  } finally {
    delete process.env.OPERATOR_PRIVATE_KEY;
  }
  const lines = await logLines("approve");
  assert.equal(lines.length, 1);
  assert.equal(lines[0].result, "failed");
  assert.match(lines[0].error ?? "", /listing on .* failed/);
  assert.equal(lines[0].actorId, v.id);
});

test("action log: no route in the site updates or deletes a log line", () => {
  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(f)) files.push(p);
    }
  };
  walk(join(import.meta.dirname, "../src"));
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    assert.doesNotMatch(text, /\.(update|delete)\(\s*(schema\.)?actionLog\b/, f);
    if (/\/api\/action-log\//.test(f)) assert.doesNotMatch(text, /export async function (POST|PATCH|PUT|DELETE)/, f);
  }
});

// ---- switch -------------------------------------------------------------------------------------------------

test("switch: default is the old shared code; personal sign-in is off and a cookie is not needed", async () => {
  const saved = process.env.VALIDATOR_AUTH;
  delete process.env.VALIDATOR_AUTH;
  try {
    const v = await addUser("validator");
    const ok = await partnersRoute.GET(req("/api/partners", { headers: { "x-admin-token": process.env.ADMIN_TOKEN! } }));
    assert.equal(ok.status, 200);
    assert.equal((await partnersRoute.GET(req("/api/partners", { headers: { "x-admin-token": "wrong-wrong-wrong-wrong-wrong-0" } }))).status, 401);
    assert.equal((await partnersRoute.GET(req("/api/partners"))).status, 401);
    assert.equal((await nonceRoute.POST(req("/api/auth/nonce", { method: "POST" }))).status, 409);
    assert.equal((await signInRoute.POST(req("/api/auth/sign-in", { method: "POST", body: {} }))).status, 409);
    assert.equal(((await (await meRoute.GET(req("/api/auth/me"))).json()) as { mode: string }).mode, "shared");
    // shared access still works for a decision and the log line says so
    const subId = await pendingSubmission();
    const r = await verificationsRoute.POST(req("/api/verifications", { method: "POST", headers: { "x-admin-token": process.env.ADMIN_TOKEN! }, body: { submissionId: subId, decision: "reject" } }));
    assert.equal(r.status, 200);
    const [line] = await logLines("reject");
    assert.equal(line.actorName, "shared access code");
    void v;
  } finally {
    process.env.VALIDATOR_AUTH = saved;
  }
});

test("switch: an unset or short ADMIN_TOKEN lets nobody in (fail closed)", async () => {
  const saved = process.env.VALIDATOR_AUTH;
  const token = process.env.ADMIN_TOKEN;
  delete process.env.VALIDATOR_AUTH;
  process.env.ADMIN_TOKEN = "short";
  try {
    assert.equal((await partnersRoute.GET(req("/api/partners", { headers: { "x-admin-token": "short" } }))).status, 401);
    delete process.env.ADMIN_TOKEN;
    assert.equal((await partnersRoute.GET(req("/api/partners", { headers: { "x-admin-token": "" } }))).status, 401);
  } finally {
    process.env.VALIDATOR_AUTH = saved;
    process.env.ADMIN_TOKEN = token;
  }
});

// ---- review follow-ups -----------------------------------------------------------------------------------

test("shared code: a non-ASCII header of the same length is refused, not a server error", async () => {
  const saved = process.env.VALIDATOR_AUTH;
  delete process.env.VALIDATOR_AUTH;
  try {
    const res = await partnersRoute.GET(req("/api/partners", { headers: { "x-admin-token": "é".repeat(process.env.ADMIN_TOKEN!.length) } }));
    assert.equal(res.status, 401);
  } finally {
    process.env.VALIDATOR_AUTH = saved;
  }
});

test("sign-in: a null or non-object body is refused, not a server error", async () => {
  for (const body of [null, 5, "x", [1]]) {
    const res = await signInRoute.POST(req("/api/auth/sign-in", { method: "POST", body }));
    assert.equal(res.status, 401);
  }
});

test("two admins removing each other at once leave one active admin", async () => {
  const a1 = await addUser("admin", "One");
  const a2 = await addUser("admin", "Two");
  const c1 = await signIn(a1);
  const c2 = await signIn(a2);
  const [r1, r2] = await Promise.all([
    validatorRoute.PATCH(req(`/api/validators/${a2.id}`, { method: "PATCH", cookie: c1, body: { remove: true } }), params(a2.id)),
    validatorRoute.PATCH(req(`/api/validators/${a1.id}`, { method: "PATCH", cookie: c2, body: { remove: true } }), params(a1.id)),
  ]);
  assert.deepEqual([r1.status, r2.status].sort(), [200, 409]);
  const active = (await db.select().from(schema.users)).filter((u) => u.active && u.role === "admin");
  assert.equal(active.length, 1);
  assert.equal((await logLines("validator_remove")).length, 1);
});

test("removal ends the sessions, and re-adding the wallet does not bring the old cookie back", async () => {
  const adm = await addUser("admin");
  const v = await addUser("validator");
  const ac = await signIn(adm);
  const vc = await signIn(v);
  await validatorRoute.PATCH(req(`/api/validators/${v.id}`, { method: "PATCH", cookie: ac, body: { remove: true } }), params(v.id));
  await validatorsRoute.POST(req("/api/validators", { method: "POST", cookie: ac, body: { wallet: v.account.address, name: "Back", role: "validator" } }));
  assert.equal((await partnersRoute.GET(req("/api/partners", { cookie: vc }))).status, 401);
});

test("detaching a partner twice writes one log line; the action log pages without skipping lines that share a time", async () => {
  const adm = await addUser("admin");
  const ac = await signIn(adm);
  const pid = ((await (await partnersRoute.POST(req("/api/partners", { method: "POST", cookie: ac, body: { name: "P2", payoutAddress: "0x" + "1".repeat(40), feeBps: 100 } }))).json()) as { id: string }).id;
  const listing = await insertListing(pid);
  const del = () => listingPartnerRoute.DELETE(req(`/api/listings/${listing}/partner`, { method: "DELETE", cookie: ac }), params(listing));
  assert.equal((await del()).status, 200);
  assert.equal((await del()).status, 200);
  assert.equal((await logLines("partner_detach")).length, 1);

  await db.execute(sql`update action_log set created_at = '2026-01-01T00:00:00Z'`);
  const seen: string[] = [];
  let before = "";
  for (let i = 0; i < 10; i++) {
    const page = (await (await logRoute.GET(req(`/api/action-log?limit=1${before}`, { cookie: ac }))).json()) as { id: string; createdAt: string }[];
    if (page.length === 0) break;
    seen.push(page[0].id);
    before = `&before=${encodeURIComponent(`${new Date(page[0].createdAt).toISOString()},${page[0].id}`)}`;
  }
  const total = (await db.select().from(schema.actionLog)).length;
  assert.equal(new Set(seen).size, total);
  assert.equal(seen.length, total);
});

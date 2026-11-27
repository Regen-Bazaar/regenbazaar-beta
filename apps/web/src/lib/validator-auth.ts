// Validator access. Two modes, chosen by the server environment variable VALIDATOR_AUTH:
//   "shared"   (default, today's behaviour): the shared ADMIN_TOKEN sent as x-admin-token; fail closed if unset.
//   "personal": wallet sign-in (Sign-In with Ethereum, built into viem) -> server-side session in the database,
//               roles (validator, admin) and revocation. The old header is ignored completely in this mode.
// Every guarded entry point calls requireActor(); the account is re-read from the database on every request,
// so removing a validator takes effect on their next click.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { createSiweMessage, parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { recoverMessageAddress, isAddress } from "viem";
import { authNonces, users, validatorSessions } from "@rb/db/schema";
import { getDb } from "./db";
import { SITE_URL } from "./site";
import { NONCE_TTL_MS, SIGN_IN_STATEMENT } from "./validator-constants";

export { NONCE_TTL_MS, SIGN_IN_STATEMENT };

export type Role = "validator" | "admin"; // "validator" is the roadmap's "reviewer"
export type Actor = {
  userId: string | null; // null = the shared access code (nobody can tell who)
  wallet: string | null;
  name: string | null;
  role: Role;
  via: "session" | "shared";
};

export const SESSION_COOKIE = "rb_session";
export const SESSION_SECONDS = 7 * 24 * 3600;
const MAX_MESSAGE_LIFETIME_MS = 10 * 60_000;

export type AuthMode = "shared" | "personal";
export const authMode = (): AuthMode => (process.env.VALIDATOR_AUTH === "personal" ? "personal" : "shared");

export const siteHost = () => new URL(SITE_URL).host;
export const siteOrigin = () => new URL(SITE_URL).origin;

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const normalizeWallet = (w: string) => w.trim().toLowerCase();
export const isWalletString = (w: unknown): w is string => typeof w === "string" && /^0x[0-9a-fA-F]{40}$/.test(w.trim());

function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/** State-changing requests that carry a session must come from our own site (the cookie is also SameSite=Strict). */
export function sameOrigin(req: Request): boolean {
  return req.headers.get("origin") === siteOrigin();
}

function sharedActor(req: Request): Actor | null {
  const expected = process.env.ADMIN_TOKEN ?? "";
  const got = req.headers.get("x-admin-token") ?? "";
  if (expected.length < 16 || got.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(got), Buffer.from(expected))) return null;
  return { userId: null, wallet: null, name: null, role: "admin", via: "shared" };
}

/** The signed-in validator for this request, or null. Never throws on a bad cookie. */
export async function authenticate(req: Request): Promise<Actor | null> {
  if (authMode() === "shared") return sharedActor(req);
  const token = readCookie(req, SESSION_COOKIE);
  if (!token || !/^[0-9a-f]{64}$/.test(token)) return null;
  const safe = req.method === "GET" || req.method === "HEAD";
  if (!safe && !sameOrigin(req)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ id: users.id, wallet: users.walletAddress, name: users.displayName, role: users.role, active: users.active, removedAt: users.removedAt })
    .from(validatorSessions)
    .innerJoin(users, eq(validatorSessions.userId, users.id))
    .where(and(eq(validatorSessions.tokenHash, hashToken(token)), isNull(validatorSessions.revokedAt), gt(validatorSessions.expiresAt, new Date())))
    .limit(1);
  if (!row || !row.active || row.removedAt || (row.role !== "validator" && row.role !== "admin")) return null;
  return { userId: row.id, wallet: row.wallet, name: row.name, role: row.role, via: "session" };
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

/** Guard for one entry point. "admin" = money-related and access actions; "validator" = any signed-in validator. */
export async function requireActor(req: Request, need: Role = "validator"): Promise<{ actor: Actor } | { response: Response }> {
  const actor = await authenticate(req);
  if (!actor) return { response: json({ error: "validator access required" }, 401) };
  if (need === "admin" && actor.role !== "admin") return { response: json({ error: "admin role required" }, 403) };
  return { actor };
}

export type SignInCheck = { ok: true; wallet: string; nonce: string } | { ok: false; reason: string };

/** Checks the sign-in message and signature (not the nonce store and not the account). Ordinary wallets only. */
export async function checkSignIn(message: string, signature: string, now = new Date()): Promise<SignInCheck> {
  try {
    const parsed = parseSiweMessage(message);
    const { address, nonce, issuedAt, expirationTime, uri, chainId, version, statement, domain } = parsed;
    if (!address || !nonce || !issuedAt || !expirationTime || !uri || !chainId || version !== "1" || !domain) {
      return { ok: false, reason: "incomplete message" };
    }
    if (statement !== SIGN_IN_STATEMENT) return { ok: false, reason: "wrong statement" };
    if (domain !== siteHost()) return { ok: false, reason: "message made for another site" };
    if (new URL(uri).origin !== siteOrigin()) return { ok: false, reason: "message made for another address" };
    // Strict round trip: no extra lines or fields can ride along inside what the wallet signed.
    const rebuilt = createSiweMessage({ address, chainId, domain, nonce, uri, version: "1", statement, issuedAt, expirationTime });
    if (rebuilt !== message) return { ok: false, reason: "message is not in the expected form" };
    if (!validateSiweMessage({ message: parsed as never, domain: siteHost(), time: now })) return { ok: false, reason: "expired or not yet valid" };
    if (issuedAt.getTime() > now.getTime() + 60_000) return { ok: false, reason: "issued in the future" };
    if (expirationTime.getTime() - issuedAt.getTime() > MAX_MESSAGE_LIFETIME_MS) return { ok: false, reason: "lifetime too long" };
    if (!isAddress(address)) return { ok: false, reason: "bad address" };
    const signer = await recoverMessageAddress({ message, signature: signature as `0x${string}` });
    if (normalizeWallet(signer) !== normalizeWallet(address)) return { ok: false, reason: "signature does not match the wallet" };
    return { ok: true, wallet: normalizeWallet(address), nonce };
  } catch {
    return { ok: false, reason: "invalid message or signature" };
  }
}

/** One-time sign-in number: valid 5 minutes, usable once. Returns false if unknown, used or expired. */
export async function consumeNonce(nonce: string, now = new Date()): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(authNonces)
    .set({ usedAt: now })
    .where(and(eq(authNonces.nonce, nonce), isNull(authNonces.usedAt), gt(authNonces.createdAt, new Date(now.getTime() - NONCE_TTL_MS))))
    .returning({ nonce: authNonces.nonce });
  return rows.length === 1;
}

export async function issueNonce(): Promise<string> {
  const db = await getDb();
  const nonce = randomBytes(16).toString("hex");
  await db.insert(authNonces).values({ nonce });
  return nonce;
}

export async function createSession(userId: string): Promise<string> {
  const db = await getDb();
  const token = randomBytes(32).toString("hex");
  await db.insert(validatorSessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000),
  });
  return token;
}

export const sessionCookie = (token: string, maxAge = SESSION_SECONDS) =>
  `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${SITE_URL.startsWith("https:") ? "; Secure" : ""}`;

export { readCookie };

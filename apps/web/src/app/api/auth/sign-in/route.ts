import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { users } from "@rb/db/schema";
import { getDb } from "../../../../lib/db";
import { logAction } from "../../../../lib/action-log";
import { clientIp, rateLimit } from "../../../../lib/rate-limit";
import { authMode, checkSignIn, consumeNonce, createSession, sameOrigin, sessionCookie } from "../../../../lib/validator-auth";

export const runtime = "nodejs";

const REFUSED = { error: "sign-in refused" }; // one neutral message for every reason

// POST /api/auth/sign-in { message, signature } — wallet signature (Sign-In with Ethereum). Nothing goes on-chain.
export async function POST(req: Request) {
  if (authMode() !== "personal") return NextResponse.json({ error: "personal sign-in is not enabled" }, { status: 409 });
  if (!sameOrigin(req)) return NextResponse.json(REFUSED, { status: 403 });
  if (!rateLimit(`signin:${clientIp(req)}`, 20, 600_000)) return NextResponse.json({ error: "too many attempts, try again later" }, { status: 429 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const { message, signature } = body;
  if (typeof message !== "string" || message.length > 1000 || typeof signature !== "string" || !/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    return NextResponse.json(REFUSED, { status: 401 });
  }
  const check = await checkSignIn(message, signature);
  if (!check.ok) return NextResponse.json(REFUSED, { status: 401 });
  // The wallet is proven. The one-time number is spent whatever happens next.
  const fresh = await consumeNonce(check.nonce);
  if (!fresh) return NextResponse.json(REFUSED, { status: 401 });

  const db = await getDb();
  const [u] = await db.select().from(users).where(eq(users.walletAddress, check.wallet)).limit(1);
  if (!u || !u.active || u.removedAt || (u.role !== "validator" && u.role !== "admin")) {
    await logAction(db, null, { action: "sign_in_refused", objectType: "validator", objectId: u?.id ?? null, wallet: check.wallet, error: "not an active validator" });
    return NextResponse.json(REFUSED, { status: 401 });
  }
  const token = await createSession(u.id);
  const actor = { userId: u.id, wallet: u.walletAddress, name: u.displayName, role: u.role, via: "session" as const };
  await logAction(db, actor, { action: "sign_in", objectType: "validator", objectId: u.id });
  const res = NextResponse.json({ ok: true, user: { id: u.id, wallet: u.walletAddress, name: u.displayName, role: u.role } });
  res.headers.append("set-cookie", sessionCookie(token));
  return res;
}

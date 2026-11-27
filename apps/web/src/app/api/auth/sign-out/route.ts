import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { validatorSessions } from "@rb/db/schema";
import { getDb } from "../../../../lib/db";
import { logAction } from "../../../../lib/action-log";
import { SESSION_COOKIE, authenticate, hashToken, readCookie, sameOrigin, sessionCookie } from "../../../../lib/validator-auth";

export const runtime = "nodejs";

// POST /api/auth/sign-out — ends this browser's session.
export async function POST(req: Request) {
  if (!sameOrigin(req)) return NextResponse.json({ error: "refused" }, { status: 403 });
  const actor = await authenticate(req);
  const token = readCookie(req, SESSION_COOKIE);
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    const db = await getDb();
    await db
      .update(validatorSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(validatorSessions.tokenHash, hashToken(token)), isNull(validatorSessions.revokedAt)));
    if (actor) await logAction(db, actor, { action: "sign_out", objectType: "validator", objectId: actor.userId });
  }
  const res = NextResponse.json({ ok: true });
  res.headers.append("set-cookie", sessionCookie("", 0));
  return res;
}

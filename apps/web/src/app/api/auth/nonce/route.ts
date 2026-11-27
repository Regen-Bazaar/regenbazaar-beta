import { NextResponse } from "next/server";
import { lt } from "drizzle-orm";
import { authNonces } from "@rb/db/schema";
import { getDb } from "../../../../lib/db";
import { clientIp, rateLimit } from "../../../../lib/rate-limit";
import { authMode, issueNonce, sameOrigin } from "../../../../lib/validator-auth";

export const runtime = "nodejs";

// POST /api/auth/nonce — a one-time sign-in number (valid 5 minutes, usable once).
export async function POST(req: Request) {
  if (authMode() !== "personal") return NextResponse.json({ error: "personal sign-in is not enabled" }, { status: 409 });
  if (!sameOrigin(req)) return NextResponse.json({ error: "sign-in refused" }, { status: 403 });
  if (!rateLimit(`nonce:${clientIp(req)}`, 30, 600_000)) return NextResponse.json({ error: "too many attempts, try again later" }, { status: 429 });
  const db = await getDb();
  await db.delete(authNonces).where(lt(authNonces.createdAt, new Date(Date.now() - 24 * 3600_000))); // tidy old numbers
  return NextResponse.json({ nonce: await issueNonce() });
}

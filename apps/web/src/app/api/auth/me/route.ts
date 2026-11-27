import { NextResponse } from "next/server";
import { authMode, authenticate } from "../../../../lib/validator-auth";

export const runtime = "nodejs";

// GET /api/auth/me — which sign-in the site uses, and who is signed in (if anyone).
export async function GET(req: Request) {
  const actor = await authenticate(req);
  return NextResponse.json({
    mode: authMode(),
    user: actor && actor.via === "session" ? { id: actor.userId, wallet: actor.wallet, name: actor.name, role: actor.role } : null,
  });
}

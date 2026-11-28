import { NextResponse } from "next/server";
import { getDb } from "../../../../lib/db";
import { requireActor } from "../../../../lib/validator-auth";
import { decideRequest } from "../../../../lib/withdrawals";
import { isStepDone, sendRevoke, sendWithdraw, waitForTx } from "../../../../lib/onchain";

export const runtime = "nodejs";

// POST /api/withdrawals/<id> — admin only: {decision: "approve" | "reject", note?}. Approve withdraws on-chain
// (TRWIV4 + EAS revoke) and closes the listing; a failed on-chain step leaves the request open for a retry.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await requireActor(req, "admin");
  if ("response" in a) return a.response;
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "request not found" }, { status: 404 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const r = await decideRequest(await getDb(), a.actor, id, { decision: body.decision, note: body.note }, { sendWithdraw, sendRevoke, waitForTx, isDone: isStepDone });
  return NextResponse.json(r.body, { status: r.status });
}

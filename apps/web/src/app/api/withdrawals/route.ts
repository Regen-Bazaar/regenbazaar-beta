import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";
import { requireActor } from "../../../lib/validator-auth";
import { fileRequest, listRequests } from "../../../lib/withdrawals";

export const runtime = "nodejs";

// GET /api/withdrawals — withdrawal requests (any validator). POST — file one {listingId, reason} (any validator).
export async function GET(req: Request) {
  const a = await requireActor(req);
  if ("response" in a) return a.response;
  return NextResponse.json({ requests: await listRequests(await getDb()) });
}

export async function POST(req: Request) {
  const a = await requireActor(req);
  if ("response" in a) return a.response;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const r = await fileRequest(await getDb(), a.actor, { listingId: body.listingId, reason: body.reason });
  return NextResponse.json(r.body, { status: r.status });
}

import { NextResponse } from "next/server";
import { verifications, impactSubmissions } from "@rb/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "../../../lib/db";

export const runtime = "nodejs";

// POST /api/verifications — a validator records a decision; the submission status advances.
// In beta the attester is a trusted admin; later this maps to the on-chain validator set + EAS.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const submissionId = body.submissionId;
  const decision = body.decision;
  if (
    typeof submissionId !== "string" ||
    (decision !== "approve" && decision !== "reject" && decision !== "request_info")
  ) {
    return NextResponse.json({ error: "submissionId and a valid decision are required" }, { status: 422 });
  }

  const db = await getDb();
  await db.insert(verifications).values({
    submissionId,
    decision,
    note: typeof body.note === "string" ? body.note : null,
  });

  const status =
    decision === "approve" ? "verified" : decision === "reject" ? "rejected" : "pending_verification";
  await db
    .update(impactSubmissions)
    .set({ status: status as never, updatedAt: new Date() })
    .where(eq(impactSubmissions.id, submissionId));

  return NextResponse.json({ ok: true, status });
}

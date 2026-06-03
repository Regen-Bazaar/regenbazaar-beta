import { NextResponse } from "next/server";
import { processSubmission, createAnthropicExtractor } from "@rb/pipeline";
import { impactSubmissions } from "@rb/db/schema";
import { desc, eq } from "drizzle-orm";
import { getDb, getDemoOrgId } from "../../../lib/db";

export const runtime = "nodejs";

// GET /api/submissions?status=pending_verification — list submissions (newest first).
export async function GET(req: Request) {
  const db = await getDb();
  const status = new URL(req.url).searchParams.get("status");
  const rows = await db
    .select()
    .from(impactSubmissions)
    .where(status ? eq(impactSubmissions.status, status as never) : undefined)
    .orderBy(desc(impactSubmissions.createdAt))
    .limit(100);
  return NextResponse.json(rows);
}

// POST /api/submissions — extract -> deterministically score -> persist into the verification queue.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body.title !== "string" || typeof body.description !== "string") {
    return NextResponse.json({ error: "title and description are required" }, { status: 422 });
  }

  const db = await getDb();
  const orgId = typeof body.orgId === "string" ? body.orgId : await getDemoOrgId(db);
  const extractor = process.env.ANTHROPIC_API_KEY ? createAnthropicExtractor() : undefined;

  try {
    const { submission, iv } = await processSubmission(
      db,
      {
        orgId,
        title: body.title,
        description: body.description,
        domain: body.domain as never,
        context: body.context as never,
        mediaUris: body.mediaUris as never,
      },
      { extractor },
    );
    return NextResponse.json(
      { id: submission.id, status: submission.status, impactValue: iv.impactValue, frameworkTags: iv.frameworkTags },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}

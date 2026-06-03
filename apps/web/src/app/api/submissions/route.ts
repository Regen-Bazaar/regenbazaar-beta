import { NextResponse } from "next/server";
import { processSubmission, createAnthropicExtractor } from "@rb/pipeline";
import { getDb } from "../../../lib/db";

export const runtime = "nodejs";

// POST /api/submissions — NGO submits an impact report; the server extracts (LLM or rule-based),
// deterministically scores it, and persists it into the verification queue. Returns the IV + tags.
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (
    typeof body.orgId !== "string" ||
    typeof body.title !== "string" ||
    typeof body.description !== "string"
  ) {
    return NextResponse.json({ error: "orgId, title and description are required" }, { status: 422 });
  }

  const extractor = process.env.ANTHROPIC_API_KEY ? createAnthropicExtractor() : undefined;

  try {
    const { submission, iv } = await processSubmission(
      getDb(),
      {
        orgId: body.orgId,
        title: body.title,
        description: body.description,
        domain: body.domain as never,
        context: body.context as never,
        mediaUris: body.mediaUris as never,
      },
      { extractor },
    );
    return NextResponse.json(
      {
        id: submission.id,
        status: submission.status,
        impactValue: iv.impactValue,
        tablesVersion: iv.tablesVersion,
        frameworkTags: iv.frameworkTags,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "processing failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { createDeepSeekExtractor, llmConfigured, sanitizeActionsV02 } from "@rb/pipeline";
import { isCommunityAction, ruleBasedExtract } from "@rb/impact-engine";
import { getDb } from "../../../lib/db";
import { clientIp, rateLimit } from "../../../lib/rate-limit";
import { createRunRecorder } from "../../../lib/ai-runs";

export const runtime = "nodejs";

const MAX_DESCRIPTION = 5000;
const PER_IP_PER_HOUR = 20;
const GLOBAL_PER_HOUR = 120;

// POST /api/extract { description } — public. The AI's reading of the creator's text, shown in the form so the creator
// checks the AI's list instead of a keyword parser's. Nothing is stored except the AI run log line. The text is data:
// the answer is filtered to known action types and plausible numbers (sanitizeActionsV02) and never scores anything.
export async function POST(req: Request) {
  if (!rateLimit(`ext:${clientIp(req)}`, PER_IP_PER_HOUR, 3_600_000) || !rateLimit("ext:all", GLOBAL_PER_HOUR, 3_600_000)) {
    return NextResponse.json({ error: "too many requests, please try again later" }, { status: 429 });
  }
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!description) return NextResponse.json({ error: "description is required" }, { status: 422 });
  if (description.length > MAX_DESCRIPTION) return NextResponse.json({ error: `description is limited to ${MAX_DESCRIPTION} characters` }, { status: 422 });

  const keywords = () => sanitizeActionsV02(ruleBasedExtract(description)).filter((a) => isCommunityAction(a.actionType));
  if (!llmConfigured()) return NextResponse.json({ reader: "keywords", reason: "not_configured", actions: keywords() });
  const recorder = createRunRecorder();
  try {
    const actions = sanitizeActionsV02(await createDeepSeekExtractor({ onRun: recorder.onRun }).extract(description)).filter((a) => isCommunityAction(a.actionType));
    if (actions.length === 0) return NextResponse.json({ reader: "keywords", reason: "empty", actions: keywords() });
    return NextResponse.json({ reader: "ai", actions });
  } catch {
    return NextResponse.json({ reader: "keywords", reason: "error", actions: keywords() });
  } finally {
    try {
      await recorder.flush(await getDb(), null);
    } catch {
      // the run log never changes the answer
    }
  }
}

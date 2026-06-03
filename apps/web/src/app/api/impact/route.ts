import { NextResponse } from "next/server";
import { desc, inArray } from "drizzle-orm";
import { impactSubmissions } from "@rb/db/schema";
import { getDb } from "../../../lib/db";

export const runtime = "nodejs";

// GET /api/impact — public, machine-readable catalogue of verified/tokenized real-world impact.
// Designed for AI agents to discover and evaluate impact: structured metrics + framework tags +
// transparent methodology (honest about being platform-assessed beta, not third-party certified).
export async function GET(req: Request) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(impactSubmissions)
    .where(inArray(impactSubmissions.status, ["verified", "tokenized"]))
    .orderBy(desc(impactSubmissions.ivValue))
    .limit(200);

  const items = rows.map((r) => ({
    id: r.id,
    title: r.title,
    domain: r.domain,
    status: r.status,
    impactValue: Number(r.ivValue ?? 0),
    frameworks: r.frameworkTags,
    actions: r.extractedActions,
    methodology: {
      version: r.tablesVersion,
      basis: "deterministic IV = sum(AW*SM*TBV*ESM*PIM*ACDM)",
      assessment: "platform-assessed (beta)",
      thirdPartyCertified: false,
    },
    detail: new URL(`/submission/${r.id}`, req.url).toString(),
  }));

  return NextResponse.json({ count: items.length, items });
}

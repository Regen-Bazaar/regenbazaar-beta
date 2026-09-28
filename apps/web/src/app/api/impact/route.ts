import { NextResponse } from "next/server";
import { desc, inArray } from "drizzle-orm";
import { impactSubmissions } from "@rb/db/schema";
import { getDb } from "../../../lib/db";
import { siteUrl } from "../../../lib/site";

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
    ...(r.methodologyVersion === "v0.2"
      ? { domainScores: r.domainScores, proofLevel: r.proofLevel ?? null }
      : {}),
    methodology:
      r.methodologyVersion === "v0.2"
        ? {
            version: "v0.2",
            tables: r.tablesVersion,
            basis: "deterministic: domain score = sum(units*AW*SM*ESM*S); IV = sum(domain score*k); proof level P0-P4 set by a validator, not part of IV",
            assessment: "Regen Bazaar relative index, Community layer",
            thirdPartyCertified: false,
          }
        : {
            version: r.tablesVersion,
            basis: "deterministic IV = sum(AW*SM*TBV*ESM*PIM*ACDM)",
            assessment: "platform-assessed (beta)",
            thirdPartyCertified: false,
          },
    detail: siteUrl(`/submission/${r.id}`),
  }));

  return NextResponse.json({ count: items.length, items });
}

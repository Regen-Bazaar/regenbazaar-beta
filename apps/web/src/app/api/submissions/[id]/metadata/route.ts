import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { impactSubmissions } from "@rb/db/schema";
import { buildTokenMetadata } from "@rb/pipeline";
import type { ExtractedAction, FrameworkTags } from "@rb/impact-engine";
import { getDb } from "../../../../../lib/db";

export const runtime = "nodejs";

// GET /api/submissions/<id>/metadata — preview the PUBLIC tRWI token metadata JSON that would be
// pinned to IPFS and travel with the token. This is exactly what a buyer's wallet/marketplace reads.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = await getDb();
  const [s] = await db.select().from(impactSubmissions).where(eq(impactSubmissions.id, id)).limit(1);
  if (!s) return NextResponse.json({ error: "not found" }, { status: 404 });

  const c = (s.context ?? {}) as { regionCode?: string; periodStart?: string; periodEnd?: string };
  const meta = buildTokenMetadata({
    title: s.title,
    domain: s.domain,
    actions: (s.extractedActions ?? []) as ExtractedAction[],
    frameworks: s.frameworkTags as FrameworkTags | null,
    impactValue: Number(s.ivValue ?? 0),
    editions: 100, // chosen at mint; preview uses a representative value
    regionCode: c.regionCode ?? null,
    periodStart: c.periodStart ?? null,
    periodEnd: c.periodEnd ?? null,
    tablesVersion: s.tablesVersion ?? "",
    easUID: null, // set once the EAS attestation exists (at mint)
    externalUrl: new URL(`/submission/${s.id}`, req.url).toString(),
  });

  return NextResponse.json(meta);
}

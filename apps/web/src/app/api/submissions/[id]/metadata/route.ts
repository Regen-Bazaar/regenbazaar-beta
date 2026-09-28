import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { impactSubmissions } from "@rb/db/schema";
import { buildTokenMetadata } from "@rb/pipeline";
import { parseProofLevel, type DomainScoreV02, type ExtractedAction, type FrameworkTags } from "@rb/impact-engine";
import { getDb } from "../../../../../lib/db";
import { isAdmin } from "../../../../../lib/admin";
import { siteUrl } from "../../../../../lib/site";

export const runtime = "nodejs";

const PUBLIC_STATUSES = ["verified", "tokenized"];

// GET /api/submissions/<id>/metadata — preview the PUBLIC tRWI token metadata JSON that would be
// pinned to IPFS and travel with the token. This is exactly what a buyer's wallet/marketplace reads.
// Pending and rejected reports are visible to validators only (same gate as the card image).
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const db = await getDb();
  const [s] = await db.select().from(impactSubmissions).where(eq(impactSubmissions.id, id)).limit(1);
  if (!s || (!PUBLIC_STATUSES.includes(s.status) && !isAdmin(req))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const c = (s.context ?? {}) as { regionCode?: string; country?: string; periodStart?: string; periodEnd?: string };
  const meta = buildTokenMetadata({
    title: s.title,
    domain: s.domain,
    actions: (s.extractedActions ?? []) as ExtractedAction[],
    frameworks: s.frameworkTags as FrameworkTags | null,
    impactValue: Number(s.ivValue ?? 0),
    editions: 100, // chosen at mint; preview uses a representative value
    regionCode: c.regionCode ?? c.country ?? null, // coarse only: v0.2 publishes the country, never coordinates
    periodStart: c.periodStart ?? null,
    periodEnd: c.periodEnd ?? null,
    tablesVersion: s.tablesVersion ?? "",
    easUID: null, // set once the EAS attestation exists (at mint)
    externalUrl: siteUrl(`/submission/${s.id}`),
    methodologyVersion: s.methodologyVersion ?? null,
    domainScores: (s.domainScores ?? []) as DomainScoreV02[],
    proofLevel: parseProofLevel(s.proofLevel),
    iris: (s.frameworkTags as { iris?: string[] } | null)?.iris ?? [],
  });

  return NextResponse.json(meta);
}

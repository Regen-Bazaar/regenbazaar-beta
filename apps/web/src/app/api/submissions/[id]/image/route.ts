import { eq } from "drizzle-orm";
import { impactSubmissions, organizations } from "@rb/db/schema";
import { renderImpactCard } from "@rb/pipeline";
import { getDb } from "../../../../../lib/db";

export const runtime = "nodejs";

// GET /api/submissions/<id>/image — the generative tRWI card (same SVG that is pinned to IPFS on approval).
// Only approved reports are rendered publicly.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("not found", { status: 404 });
  const db = await getDb();
  const [row] = await db
    .select({ s: impactSubmissions, orgName: organizations.name })
    .from(impactSubmissions)
    .innerJoin(organizations, eq(impactSubmissions.orgId, organizations.id))
    .where(eq(impactSubmissions.id, id))
    .limit(1);
  if (!row || !["verified", "tokenized"].includes(row.s.status)) return new Response("not found", { status: 404 });
  const c = (row.s.context ?? {}) as { periodStart?: string; periodEnd?: string };
  const svg = renderImpactCard({
    seed: row.s.id,
    title: row.s.title,
    orgName: row.orgName,
    domain: row.s.domain,
    impactValue: Number(row.s.ivValue ?? 0),
    sdgs: (row.s.frameworkTags as { sdg?: string[] } | null)?.sdg ?? [],
    periodStart: c.periodStart ?? null,
    periodEnd: c.periodEnd ?? null,
  });
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
      // Defence in depth if opened directly: no scripts, no external loads.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      "x-content-type-options": "nosniff",
    },
  });
}

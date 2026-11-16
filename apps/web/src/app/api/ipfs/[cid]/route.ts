import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { listings } from "@rb/db/schema";
import { getDb } from "../../../../lib/db";
import { ipfsToGateway } from "../../../../lib/ipfs";

export const runtime = "nodejs";

// GET /api/ipfs/<cid> — public read of token metadata pinned on our own IPFS node (its gateway is internal).
// Serves only CIDs that are the metadata of a listing, so it is not an open IPFS proxy.
export async function GET(_req: Request, ctx: { params: Promise<{ cid: string }> }) {
  const { cid } = await ctx.params;
  if (!/^[a-z2-7]{20,100}$|^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(cid)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const db = await getDb();
  const [l] = await db.select({ id: listings.id }).from(listings).where(eq(listings.metadataUri, `ipfs://${cid}`)).limit(1);
  if (!l) return NextResponse.json({ error: "not found" }, { status: 404 });
  const res = await fetch(ipfsToGateway(`ipfs://${cid}`), { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return NextResponse.json({ error: "ipfs node unavailable" }, { status: 502 });
  const body = await res.text();
  if (body.length > 256_000) return NextResponse.json({ error: "too large" }, { status: 502 });
  // Content-addressed: the bytes never change for this CID.
  return new NextResponse(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
      "x-ipfs-path": `/ipfs/${cid}`,
    },
  });
}

import { NextResponse } from "next/server";
import { verifications, impactSubmissions, organizations, listings } from "@rb/db/schema";
import { buildTokenMetadata } from "@rb/pipeline";
import { computePrice, type ExtractedAction, type FrameworkTags } from "@rb/impact-engine";
import { eq, sql } from "drizzle-orm";
import { parseUnits } from "viem";
import { getDb } from "../../../lib/db";
import { pinJson } from "../../../lib/ipfs";
import { onchainEnabled, attestImpact, ivToWei } from "../../../lib/onchain";
import type { DB } from "@rb/db";

export const runtime = "nodejs";

const MAX_EDITIONS = 100;
const NATIVE = "0x0000000000000000000000000000000000000000";

type Hex = `0x${string}`;

// On approve (v2 lazy mint): pin metadata -> EAS attest (platform) -> register an off-chain primary
// LISTING (no mint; the buyer lazily mints on redeem via a signed voucher). Returns the listing refs.
async function registerListing(db: DB, submissionId: string, reqUrl: string) {
  const [s] = await db.select().from(impactSubmissions).where(eq(impactSubmissions.id, submissionId)).limit(1);
  if (!s || !s.ivValue) throw new Error("submission not found or unscored");
  const [org] = await db.select().from(organizations).where(eq(organizations.id, s.orgId)).limit(1);
  if (!org) throw new Error("org not found");
  const ngo = org.walletAddress as Hex;

  const c = (s.context ?? {}) as { regionCode?: string; periodStart?: string; periodEnd?: string };
  const meta = buildTokenMetadata({
    title: s.title,
    domain: s.domain,
    actions: (s.extractedActions ?? []) as ExtractedAction[],
    frameworks: s.frameworkTags as FrameworkTags | null,
    impactValue: Number(s.ivValue),
    editions: MAX_EDITIONS,
    regionCode: c.regionCode ?? null,
    periodStart: c.periodStart ?? null,
    periodEnd: c.periodEnd ?? null,
    tablesVersion: s.tablesVersion ?? "",
    externalUrl: new URL(`/submission/${s.id}`, reqUrl).toString(),
  });

  const metadataURI = await pinJson(meta); // ipfs://<cid>
  const { uid } = await attestImpact(ngo, s.ivValue, metadataURI); // platform attests provenance

  // assign the next on-chain tokenId off-chain (collection materializes on first redeem)
  const [{ m }] = await db.select({ m: sql<string>`coalesce(max(${listings.tokenId}), 0)` }).from(listings);
  const tokenId = (BigInt(m ?? "0") + 1n).toString();

  const price = computePrice(Number(s.ivValue), MAX_EDITIONS);
  const pricePerEditionWei = parseUnits(price.pricePerEdition.toFixed(18), 18).toString();

  await db.insert(listings).values({
    submissionId,
    tokenId,
    totalIvWei: ivToWei(s.ivValue).toString(),
    maxEditions: MAX_EDITIONS,
    pricePerEdition: pricePerEditionWei,
    currency: NATIVE,
    beneficiary: ngo,
    easUid: uid,
    metadataUri: metadataURI,
    nonce: 0,
    active: true,
  });

  return { tokenId, easUid: uid, metadataURI, pricePerEditionWei };
}

// POST /api/verifications — validator decision. Approve registers the on-chain-ready listing (lazy mint).
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

  if (decision === "reject") {
    await db.update(impactSubmissions).set({ status: "rejected", updatedAt: new Date() }).where(eq(impactSubmissions.id, submissionId));
    return NextResponse.json({ ok: true, status: "rejected" });
  }
  if (decision === "request_info") {
    return NextResponse.json({ ok: true, status: "pending_verification" });
  }

  // approve
  if (onchainEnabled()) {
    try {
      const listing = await registerListing(db, submissionId, req.url);
      await db.update(impactSubmissions).set({ status: "tokenized", updatedAt: new Date() }).where(eq(impactSubmissions.id, submissionId));
      return NextResponse.json({ ok: true, status: "tokenized", listing });
    } catch (e) {
      await db.update(impactSubmissions).set({ status: "verified", updatedAt: new Date() }).where(eq(impactSubmissions.id, submissionId));
      return NextResponse.json({ ok: true, status: "verified", listingError: e instanceof Error ? e.message : "listing failed" });
    }
  }
  await db.update(impactSubmissions).set({ status: "verified", updatedAt: new Date() }).where(eq(impactSubmissions.id, submissionId));
  return NextResponse.json({ ok: true, status: "verified" });
}

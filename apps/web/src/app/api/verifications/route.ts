import { NextResponse } from "next/server";
import { verifications, impactSubmissions, organizations, listings } from "@rb/db/schema";
import { buildTokenMetadata, renderImpactCard } from "@rb/pipeline";
import { computePrice, type ExtractedAction, type FrameworkTags } from "@rb/impact-engine";
import { and, eq, sql } from "drizzle-orm";
import { parseUnits } from "viem";
import { getDb } from "../../../lib/db";
import { pinFile, pinJson } from "../../../lib/ipfs";
import { onchainEnabled, attestImpact, ivToWei } from "../../../lib/onchain";
import { enabledNetworks, type Network } from "../../../lib/networks";
import type { DB } from "@rb/db";
import { isAdmin } from "../../../lib/admin";

export const runtime = "nodejs";

const MAX_EDITIONS = 100;

type Hex = `0x${string}`;

// On approve (v2 lazy mint): pin metadata -> EAS attest (platform) -> register an off-chain primary
// LISTING (no mint; the buyer lazily mints on redeem via a signed voucher). Returns the listing refs.
async function registerListing(db: DB, net: Network, submissionId: string, reqUrl: string) {
  // Idempotent per (submission, chain): re-approving never creates a second listing of the same impact.
  const [existing] = await db
    .select()
    .from(listings)
    .where(and(eq(listings.submissionId, submissionId), eq(listings.chainId, net.chain.id)))
    .limit(1);
  if (existing) {
    return { network: net.key, tokenId: String(existing.tokenId), easUid: existing.easUid, existing: true };
  }
  const [s] = await db.select().from(impactSubmissions).where(eq(impactSubmissions.id, submissionId)).limit(1);
  if (!s || !s.ivValue) throw new Error("submission not found or unscored");
  const [org] = await db.select().from(organizations).where(eq(organizations.id, s.orgId)).limit(1);
  if (!org) throw new Error("org not found");
  const ngo = org.walletAddress as Hex;

  const c = (s.context ?? {}) as { regionCode?: string; periodStart?: string; periodEnd?: string };
  // Generative artwork (deterministic from the impact data), pinned so the token image outlives our site.
  const card = renderImpactCard({
    seed: s.id,
    title: s.title,
    orgName: org.name,
    domain: s.domain,
    impactValue: Number(s.ivValue),
    sdgs: (s.frameworkTags as FrameworkTags | null)?.sdg ?? [],
    periodStart: c.periodStart ?? null,
    periodEnd: c.periodEnd ?? null,
  });
  const imageUri = await pinFile(card, "trwi.svg", "image/svg+xml");
  const meta = buildTokenMetadata({
    imageUri,
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
  const { uid } = await attestImpact(net, ngo, s.ivValue, metadataURI); // platform attests provenance

  // assign the next on-chain tokenId off-chain (collection materializes on first redeem)
  const [{ m }] = await db
    .select({ m: sql<string>`coalesce(max(${listings.tokenId}), 0)` })
    .from(listings)
    .where(eq(listings.chainId, net.chain.id));
  const tokenId = (BigInt(m ?? "0") + 1n).toString();

  const price = computePrice(Number(s.ivValue), MAX_EDITIONS);
  const { address: currency, decimals } = net.saleCurrency;
  const pricePerEditionWei = parseUnits(price.pricePerEdition.toFixed(decimals), decimals).toString();

  await db.insert(listings).values({
    submissionId,
    chainId: net.chain.id,
    tokenId,
    totalIvWei: ivToWei(s.ivValue).toString(),
    maxEditions: MAX_EDITIONS,
    pricePerEdition: pricePerEditionWei,
    currency,
    beneficiary: ngo,
    easUid: uid,
    metadataUri: metadataURI,
    nonce: 0,
    active: true,
  });

  return { network: net.key, tokenId, easUid: uid, metadataURI, pricePerEditionWei, existing: false };
}

// POST /api/verifications — validator decision. Approve registers the on-chain-ready listing (lazy mint).
export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "validator access required" }, { status: 401 });
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

  // approve: attest + list on every enabled network (each independently; one failing does not block the other)
  if (onchainEnabled()) {
    const results = [];
    for (const net of enabledNetworks()) {
      try {
        results.push({ ok: true, ...(await registerListing(db, net, submissionId, req.url)) });
      } catch (e) {
        results.push({ ok: false, network: net.key, error: e instanceof Error ? e.message.slice(0, 200) : "listing failed" });
      }
    }
    const listed = results.some((r) => r.ok);
    const status = listed ? "tokenized" : "verified";
    await db.update(impactSubmissions).set({ status, updatedAt: new Date() }).where(eq(impactSubmissions.id, submissionId));
    return NextResponse.json({ ok: true, status, listings: results });
  }
  await db.update(impactSubmissions).set({ status: "verified", updatedAt: new Date() }).where(eq(impactSubmissions.id, submissionId));
  return NextResponse.json({ ok: true, status: "verified" });
}

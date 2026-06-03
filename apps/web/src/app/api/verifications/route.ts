import { NextResponse } from "next/server";
import { verifications, impactSubmissions, organizations, attestations, tokenizations } from "@rb/db/schema";
import { buildTokenMetadata } from "@rb/pipeline";
import type { ExtractedAction, FrameworkTags } from "@rb/impact-engine";
import { eq } from "drizzle-orm";
import { getDb } from "../../../lib/db";
import { pinJson } from "../../../lib/ipfs";
import { onchainEnabled, operatorAddress, impactClaimSchemaUid, attestImpact, mintImpact } from "../../../lib/onchain";
import type { DB } from "@rb/db";

export const runtime = "nodejs";

const EDITIONS = 100n;
const ROYALTY_BPS = 500;

type Hex = `0x${string}`;

// On approve with on-chain enabled: pin metadata -> EAS attest (impactValue scaled 1e18 in onchain.ts)
// -> mint fractional tRWI -> record attestation + tokenization. Returns the new status + on-chain refs.
async function tokenize(db: DB, submissionId: string, reqUrl: string) {
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
    editions: Number(EDITIONS),
    regionCode: c.regionCode ?? null,
    periodStart: c.periodStart ?? null,
    periodEnd: c.periodEnd ?? null,
    tablesVersion: s.tablesVersion ?? "",
    externalUrl: new URL(`/submission/${s.id}`, reqUrl).toString(),
  });

  const metadataURI = await pinJson(meta); // ipfs://<cid>
  const { uid, txHash: attestTx } = await attestImpact(ngo, s.ivValue, metadataURI);
  const { tokenId, txHash: mintTx } = await mintImpact(uid, ngo, EDITIONS, ROYALTY_BPS);

  await db.insert(attestations).values({
    submissionId,
    easUid: uid,
    schemaUid: impactClaimSchemaUid,
    attester: operatorAddress(),
    txHash: attestTx,
  });
  await db.insert(tokenizations).values({
    submissionId,
    easUid: uid,
    tokenId: tokenId.toString(),
    editions: Number(EDITIONS),
    txHash: mintTx,
  });

  return { tokenId: tokenId.toString(), easUid: uid, attestTx, mintTx, metadataURI };
}

// POST /api/verifications — a validator records a decision; the submission status advances.
// Approve attests + mints the tRWI on-chain when configured; otherwise it just marks it verified.
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
      const onchain = await tokenize(db, submissionId, req.url);
      await db.update(impactSubmissions).set({ status: "tokenized", updatedAt: new Date() }).where(eq(impactSubmissions.id, submissionId));
      return NextResponse.json({ ok: true, status: "tokenized", onchain });
    } catch (e) {
      // Verified, but tokenization failed (pinning/RPC/etc) — leave it retryable, don't lose the approval.
      await db.update(impactSubmissions).set({ status: "verified", updatedAt: new Date() }).where(eq(impactSubmissions.id, submissionId));
      return NextResponse.json({ ok: true, status: "verified", tokenizeError: e instanceof Error ? e.message : "tokenize failed" });
    }
  }
  await db.update(impactSubmissions).set({ status: "verified", updatedAt: new Date() }).where(eq(impactSubmissions.id, submissionId));
  return NextResponse.json({ ok: true, status: "verified" });
}

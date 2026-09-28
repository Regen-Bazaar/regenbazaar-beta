import { NextResponse } from "next/server";
import { verifications, impactSubmissions, organizations, listings } from "@rb/db/schema";
import { buildTokenMetadata, renderImpactCard } from "@rb/pipeline";
import {
  clampEsm,
  computeImpactValueV02,
  computePrice,
  computePriceV02,
  type ComplexityAnswers,
  isListable,
  parseProofLevel,
  type DomainScoreV02,
  type ExtractedAction,
  type ExtractedActionV02,
  type FrameworkTags,
  type ImpactContextV02,
  type ProofLevel,
} from "@rb/impact-engine";
import { eq, sql } from "drizzle-orm";
import { parseUnits } from "viem";
import { getDb } from "../../../lib/db";
import { pinFile, pinJson } from "../../../lib/ipfs";
import { onchainEnabled, attestImpact, ivToWei } from "../../../lib/onchain";
import { DEFAULT_NETWORK_KEY, ENABLED_NETWORKS, getNetwork, networkByChainId, usdPerUnit, type Network } from "../../../lib/networks";
import type { DB } from "@rb/db";
import { isAdmin } from "../../../lib/admin";
import { cardHeadline } from "../../../lib/impact-view";

export const runtime = "nodejs";

const MAX_EDITIONS = 100;

type Hex = `0x${string}`;

// On approve (v2 lazy mint): pin metadata -> EAS attest (platform) -> register an off-chain primary
// LISTING (no mint; the buyer lazily mints on redeem via a signed voucher). Returns the listing refs.
async function registerListing(db: DB, net: Network, submissionId: string, reqUrl: string) {
  // One report, one listing: if this impact is already listed on ANY network, never list it again
  // (re-approving is idempotent and a report is never mirrored onto a second chain).
  const [existing] = await db.select().from(listings).where(eq(listings.submissionId, submissionId)).limit(1);
  if (existing) {
    const where = networkByChainId(existing.chainId)?.key ?? String(existing.chainId);
    return { network: where, tokenId: String(existing.tokenId), easUid: existing.easUid, existing: true };
  }
  const [s] = await db.select().from(impactSubmissions).where(eq(impactSubmissions.id, submissionId)).limit(1);
  if (!s || !s.ivValue) throw new Error("submission not found or unscored");
  const [org] = await db.select().from(organizations).where(eq(organizations.id, s.orgId)).limit(1);
  if (!org) throw new Error("org not found");
  const ngo = org.walletAddress as Hex;

  const c = (s.context ?? {}) as { regionCode?: string; country?: string; periodStart?: string; periodEnd?: string };
  const v02 = s.methodologyVersion === "v0.2";
  const domainScores = v02 ? ((s.domainScores ?? []) as DomainScoreV02[]) : [];
  const proofLevel = v02 ? (parseProofLevel(s.proofLevel) ?? null) : null;
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
    headline: cardHeadline(s),
    proofLevel,
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
    regionCode: c.regionCode ?? c.country ?? null, // coarse only: v0.2 publishes the country, never coordinates
    periodStart: c.periodStart ?? null,
    periodEnd: c.periodEnd ?? null,
    tablesVersion: s.tablesVersion ?? "",
    externalUrl: new URL(`/submission/${s.id}`, reqUrl).toString(),
    methodologyVersion: s.methodologyVersion ?? null,
    domainScores,
    proofLevel,
    iris: ((s.frameworkTags as { iris?: string[] } | null)?.iris ?? []),
  });

  const metadataURI = await pinJson(meta); // ipfs://<cid>
  const { uid, txHash } = await attestImpact(net, ngo, s.ivValue, metadataURI); // platform attests provenance

  // assign the next on-chain tokenId off-chain (collection materializes on first redeem)
  const [{ m }] = await db
    .select({ m: sql<string>`coalesce(max(${listings.tokenId}), 0)` })
    .from(listings)
    .where(eq(listings.chainId, net.chain.id));
  const tokenId = (BigInt(m ?? "0") + 1n).toString();

  const { address: currency, decimals } = net.saleCurrency;
  // v0.2 (D4): price in USD = IV × rate × P × C, settled in the sale currency at its USD value.
  // v0.1 reports keep the v0.1 rule (IV × rate in the sale currency).
  const priceV02 = v02
    ? computePriceV02(Number(s.ivValue), proofLevel, (s.context as { complexity?: ComplexityAnswers } | null)?.complexity, MAX_EDITIONS)
    : null;
  if (v02 && !priceV02) throw new Error("a v0.2 report needs a proof level P1–P4 before it is priced");
  const perEdition = priceV02 ? priceV02.perEditionUsd / usdPerUnit(net.saleCurrency) : computePrice(Number(s.ivValue), MAX_EDITIONS).pricePerEdition;
  // Prices are rounded to 4 decimals; toFixed(18) would expose binary float noise (0.369 -> 0.368999999999999995),
  // so cap at 6 decimals: exact for the rounded price, unchanged for 6-decimal USDG.
  const pricePerEditionWei = parseUnits(perEdition.toFixed(Math.min(decimals, 6)), decimals).toString();

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
    priceUsd: priceV02 ? priceV02.totalUsd.toFixed(4) : null,
    priceModelVersion: priceV02 ? priceV02.modelVersion : null,
    nonce: 0,
    active: true,
  });

  return { network: net.key, tokenId, easUid: uid, attestTx: txHash, metadataURI, pricePerEditionWei, existing: false };
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

  // v0.2 review fields: the proof level is set here and only here (never by the submitter or the AI);
  // ESM is the validator's confirmation of the open-data suggestion, clamped to 1.0..1.3.
  const proofLevel: ProofLevel | null = body.proofLevel === undefined || body.proofLevel === null ? null : parseProofLevel(body.proofLevel);
  if (body.proofLevel !== undefined && body.proofLevel !== null && !proofLevel) {
    return NextResponse.json({ error: "proofLevel must be one of P0, P1, P2, P3, P4" }, { status: 422 });
  }
  let esm: number | null = null;
  if (body.esm !== undefined && body.esm !== null) {
    if (typeof body.esm !== "number" || !Number.isFinite(body.esm) || body.esm < 1 || body.esm > 1.3) {
      return NextResponse.json({ error: "esm must be a number from 1.0 to 1.3" }, { status: 422 });
    }
    esm = clampEsm(body.esm);
  }

  const db = await getDb();
  const [target] = await db.select().from(impactSubmissions).where(eq(impactSubmissions.id, submissionId)).limit(1);
  if (!target) return NextResponse.json({ error: "submission not found" }, { status: 404 });
  const isV02 = target.methodologyVersion === "v0.2";
  if (decision === "approve" && isV02 && !isListable(proofLevel ?? parseProofLevel(target.proofLevel))) {
    return NextResponse.json({ error: "set a proof level P1–P4 before approving (P0 is not listed)" }, { status: 422 });
  }
  if (isV02 && (proofLevel || esm !== null)) {
    const patch: Partial<typeof impactSubmissions.$inferInsert> = { updatedAt: new Date() };
    if (proofLevel) patch.proofLevel = proofLevel;
    if (esm !== null) {
      // Rescore with the confirmed ESM; the formula and tables stay v0.2, only the context changes.
      const ctx = { ...((target.context ?? {}) as ImpactContextV02), esm };
      const iv = computeImpactValueV02((target.extractedActions ?? []) as ExtractedActionV02[], ctx);
      Object.assign(patch, {
        context: ctx,
        ivResult: iv,
        ivValue: iv.impactValue.toFixed(4),
        domainScores: iv.domainScores,
        frameworkTags: iv.frameworkTags,
      });
    }
    await db.update(impactSubmissions).set(patch).where(eq(impactSubmissions.id, submissionId));
  }

  // The ONE network this report is listed on: the one chosen at submission (legacy rows without a network ->
  // default). Resolved before the decision is recorded so a refused approval leaves no trace.
  let net: Network | undefined;
  if (decision === "approve" && onchainEnabled()) {
    const [sub] = await db
      .select({ chainId: impactSubmissions.chainId })
      .from(impactSubmissions)
      .where(eq(impactSubmissions.id, submissionId))
      .limit(1);
    if (!sub) return NextResponse.json({ error: "submission not found" }, { status: 404 });
    net = sub.chainId == null ? getNetwork(DEFAULT_NETWORK_KEY) : networkByChainId(sub.chainId);
    if (!net || !ENABLED_NETWORKS.includes(net.key)) {
      return NextResponse.json({ error: `network ${sub.chainId} is not enabled` }, { status: 422 });
    }
  }
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

  // approve: attest + list on that one network only (never mirrored onto other chains).
  if (onchainEnabled() && net) {
    let result;
    try {
      result = await registerListing(db, net, submissionId, req.url);
    } catch (e) {
      // Keep it in the queue so the reviewer sees the failure and can retry (re-approving is idempotent).
      const error = e instanceof Error ? e.message.slice(0, 300) : "listing failed";
      return NextResponse.json({ error: `Approved, but listing on ${net.chain.name} failed: ${error}` }, { status: 502 });
    }
    await db.update(impactSubmissions).set({ status: "tokenized", updatedAt: new Date() }).where(eq(impactSubmissions.id, submissionId));
    return NextResponse.json({ ok: true, status: "tokenized", listings: [{ ok: true, ...result }] });
  }
  await db.update(impactSubmissions).set({ status: "verified", updatedAt: new Date() }).where(eq(impactSubmissions.id, submissionId));
  return NextResponse.json({ ok: true, status: "verified" });
}

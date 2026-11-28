import { NextResponse } from "next/server";
import { listings, partners } from "@rb/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { zeroAddress } from "viem";
import { getDb } from "../../../../../lib/db";
import { mintedOnChain, onchainEnabled, signVoucher, type ImpactVoucher } from "../../../../../lib/onchain";
import { contractGenerationOf } from "../../../../../lib/revision4";
import { editionLimit, editionLimitError, limitFactsFor } from "../../../../../lib/edition-limit";
import { findBuyerCurrency, networkByChainId, usdToTokenUnits, type SaleCurrency } from "../../../../../lib/networks";
import {
  PLATFORM_FEE_BPS,
  RESALE_FEE_BPS,
  RESALE_PARTNER_BPS,
  partnerShareError,
} from "../../../../../lib/partner-share";

export const runtime = "nodejs";

const ROYALTY_BPS = 250; // secondary-sale royalty to the creator, owner decision 2026-10-07 (<= TRWI MAX_ROYALTY_BPS = 1000)
const DEADLINE_SECS = 3600;

// GET /api/listings/<id>/voucher — return a freshly platform-signed EIP-712 voucher for a primary listing.
// The buyer submits {voucher, signature} to RegenPrimarySale.redeem() to pay + lazily mint editions.
// Revision 4: ?currency=<address> picks one of the network's stablecoins; the USD price is converted to it.
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!onchainEnabled()) return NextResponse.json({ error: "onchain not configured" }, { status: 503 });
  const { id } = await ctx.params;
  const db = await getDb();
  const [l] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  if (!l || !l.active) return NextResponse.json({ error: "listing not found" }, { status: 404 });
  // The listing's own chain decides the signing domain, never the visitor's cookie.
  const net = networkByChainId(l.chainId);
  if (!net) return NextResponse.json({ error: "listing network not supported" }, { status: 404 });
  // A listing is sold only on the contract generation it was attested for (never on both).
  if (l.contractGeneration !== contractGenerationOf(net)) {
    return NextResponse.json({ error: "this listing belongs to the previous contracts and is closed" }, { status: 409 });
  }
  if (l.withdrawnAt) return NextResponse.json({ error: "this impact was withdrawn" }, { status: 409 });

  // Revision 4: the buyer's coin must be on this network's list (the contract allowlist holds the same coins).
  let coin: SaleCurrency | undefined;
  if (net.primarySaleVersion === 3) {
    const asked = new URL(req.url).searchParams.get("currency") ?? "";
    coin = /^0x[0-9a-fA-F]{40}$/.test(asked) ? findBuyerCurrency(net, asked) : undefined;
    if (!coin) return NextResponse.json({ error: "choose one of this network's stablecoins" }, { status: 422 });
  }

  // Edition limit (revision 4 only): the signed mintCap binds it on-chain; refuse to sign once nothing is left.
  let mintCap: bigint | undefined;
  if (net.primarySaleVersion === 3) {
    let minted: number;
    try {
      minted = Number(await mintedOnChain(net, BigInt(l.tokenId)));
    } catch {
      return NextResponse.json({ error: `${net.chain.name} is not answering, try again in a minute` }, { status: 503 });
    }
    const now = new Date();
    if (minted > 0 && !l.firstSaleAt) {
      // First sale seen by the site (not earlier than the real one, so the 30 days never open early).
      await db.update(listings).set({ firstSaleAt: now }).where(and(eq(listings.id, l.id), isNull(listings.firstSaleAt)));
      l.firstSaleAt = now;
    }
    const limit = editionLimit(await limitFactsFor(db, l.id, now));
    const bad = editionLimitError(limit, minted, 1);
    if (bad) return NextResponse.json({ error: bad, limit }, { status: 409 });
    mintCap = BigInt(limit.cap);
  }

  // Partner share (RegenPrimarySale v2). A listing with a partner is never sold without the partner's share.
  let partner = zeroAddress as `0x${string}`;
  let partnerFeeBps = 0n;
  if (l.partnerId) {
    const [p] = await db.select().from(partners).where(eq(partners.id, l.partnerId)).limit(1);
    if (!p || !p.active) return NextResponse.json({ error: "listing partner is not active" }, { status: 409 });
    const bad = partnerShareError(p);
    if (bad) return NextResponse.json({ error: bad }, { status: 409 });
    if (net.primarySaleVersion < 2) {
      return NextResponse.json({ error: "partner share is not available on this network yet" }, { status: 409 });
    }
    partner = p.payoutAddress as `0x${string}`;
    partnerFeeBps = BigInt(p.feeBps);
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECS);
  const voucher: ImpactVoucher = {
    tokenId: BigInt(l.tokenId),
    creator: l.beneficiary as `0x${string}`, // NGO (== attestation.ngo)
    totalIV: BigInt(l.totalIvWei),
    maxEditions: BigInt(l.maxEditions),
    // Revision 4 listings hold a USD price; converted exactly into the chosen coin's own units.
    pricePerEdition: coin ? usdToTokenUnits(BigInt(l.pricePerEdition), coin) : BigInt(l.pricePerEdition),
    currency: (coin ? coin.address : l.currency) as `0x${string}`,
    beneficiary: l.beneficiary as `0x${string}`,
    easUID: l.easUid as `0x${string}`,
    metadataURI: l.metadataUri,
    royaltyBps: BigInt(ROYALTY_BPS),
    feeBps: BigInt(PLATFORM_FEE_BPS),
    partner,
    partnerFeeBps,
    nonce: BigInt(l.nonce),
    deadline,
  };
  if (net.primarySaleVersion === 3) {
    // Revision 4: editions go to the payer; resale shares are fixed on-chain at the impact's first sale.
    voucher.recipient = zeroAddress;
    voucher.resaleFeeBps = BigInt(RESALE_FEE_BPS);
    voucher.resalePartnerBps = partner === zeroAddress ? 0n : BigInt(RESALE_PARTNER_BPS);
    voucher.mintCap = mintCap;
  }
  const signature = await signVoucher(net, voucher);

  // bigints -> strings for JSON; the client reconstructs them for the redeem call.
  return NextResponse.json({
    contract: net.primarySale,
    chainId: net.chain.id,
    version: net.primarySaleVersion,
    signature,
    voucher: {
      tokenId: voucher.tokenId.toString(),
      creator: voucher.creator,
      totalIV: voucher.totalIV.toString(),
      maxEditions: voucher.maxEditions.toString(),
      pricePerEdition: voucher.pricePerEdition.toString(),
      currency: voucher.currency,
      beneficiary: voucher.beneficiary,
      easUID: voucher.easUID,
      metadataURI: voucher.metadataURI,
      royaltyBps: voucher.royaltyBps.toString(),
      feeBps: voucher.feeBps.toString(),
      partner: voucher.partner,
      partnerFeeBps: voucher.partnerFeeBps.toString(),
      nonce: voucher.nonce.toString(),
      deadline: voucher.deadline.toString(),
      ...(net.primarySaleVersion === 3
        ? {
            recipient: voucher.recipient,
            resaleFeeBps: voucher.resaleFeeBps?.toString(),
            resalePartnerBps: voucher.resalePartnerBps?.toString(),
            mintCap: voucher.mintCap?.toString(),
          }
        : {}),
    },
  });
}

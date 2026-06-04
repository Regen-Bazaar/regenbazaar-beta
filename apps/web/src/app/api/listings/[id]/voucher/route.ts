import { NextResponse } from "next/server";
import { listings } from "@rb/db/schema";
import { eq } from "drizzle-orm";
import { getDb } from "../../../../../lib/db";
import { onchainEnabled, signVoucher, type ImpactVoucher } from "../../../../../lib/onchain";

export const runtime = "nodejs";

const ROYALTY_BPS = 500; // secondary-sale royalty to the NGO creator
const DEADLINE_SECS = 3600;
const PRIMARY_SALE = process.env.PRIMARY_SALE_ADDRESS ?? "0x49A5a77e3DBd76411737820fd968142b6154be26";

// GET /api/listings/<id>/voucher — return a freshly platform-signed EIP-712 voucher for a primary listing.
// The buyer submits {voucher, signature} to RegenPrimarySale.redeem() to pay + lazily mint editions.
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!onchainEnabled()) return NextResponse.json({ error: "onchain not configured" }, { status: 503 });
  const { id } = await ctx.params;
  const db = await getDb();
  const [l] = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  if (!l || !l.active) return NextResponse.json({ error: "listing not found" }, { status: 404 });

  const deadline = BigInt(Math.floor(Date.now() / 1000) + DEADLINE_SECS);
  const voucher: ImpactVoucher = {
    tokenId: BigInt(l.tokenId),
    creator: l.beneficiary as `0x${string}`, // NGO (== attestation.ngo)
    totalIV: BigInt(l.totalIvWei),
    maxEditions: BigInt(l.maxEditions),
    pricePerEdition: BigInt(l.pricePerEdition),
    currency: l.currency as `0x${string}`,
    beneficiary: l.beneficiary as `0x${string}`,
    easUID: l.easUid as `0x${string}`,
    metadataURI: l.metadataUri,
    royaltyBps: BigInt(ROYALTY_BPS),
    nonce: BigInt(l.nonce),
    deadline,
  };
  const signature = await signVoucher(voucher);

  // bigints -> strings for JSON; the client reconstructs them for the redeem call.
  return NextResponse.json({
    contract: PRIMARY_SALE,
    chainId: 11142220,
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
      nonce: voucher.nonce.toString(),
      deadline: voucher.deadline.toString(),
    },
  });
}

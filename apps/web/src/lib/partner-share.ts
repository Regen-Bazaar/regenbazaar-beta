// Primary-sale split: platform fee + optional partner share + creator remainder (RegenPrimarySale v2).
// Caps mirror the contract (MAX_FEE_BPS, MAX_PARTNER_FEE_BPS, MAX_TOTAL_FEE_BPS); the server refuses a partner
// the contract would reject, so a buyer never gets a voucher that reverts on redeem.
import { isAddress, zeroAddress } from "viem";

export const PLATFORM_FEE_BPS = 250;
export const MAX_PARTNER_FEE_BPS = 1000;
export const MAX_TOTAL_FEE_BPS = 1500;

export interface PartnerShare {
  name: string;
  payoutAddress: string;
  feeBps: number;
}

/** Why this partner cannot be signed into a voucher, or null when it can. */
export function partnerShareError(p: PartnerShare): string | null {
  if (!isAddress(p.payoutAddress) || p.payoutAddress.toLowerCase() === zeroAddress) return "partner payout address is invalid";
  if (!Number.isInteger(p.feeBps) || p.feeBps <= 0 || p.feeBps > MAX_PARTNER_FEE_BPS) return "partner share must be 0.01% to 10%";
  if (PLATFORM_FEE_BPS + p.feeBps > MAX_TOTAL_FEE_BPS) return "platform fee and partner share exceed 15%";
  return null;
}

/** Split of the sale price in basis points (creator gets the remainder, as on-chain). */
export function saleSplitBps(partnerFeeBps: number) {
  return { platform: PLATFORM_FEE_BPS, partner: partnerFeeBps, creator: 10_000 - PLATFORM_FEE_BPS - partnerFeeBps };
}

export function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2).replace(/\.?0+$/, "")}%`;
}

// Guard for contract revision 4: the site's v3 voucher types and ImpactClaim v2 encoding must produce exactly the
// digests the contracts compute. The same fixed vector is asserted in
// packages/contracts/test/revision4/SiteEncoding.t.sol. Run: node --import tsx scripts/check-revision4-encoding.ts
import { hashTypedData, keccak256, zeroAddress, type Hex } from "viem";
import { VOUCHER_TYPES_V3, encodeImpactClaimV2, voucherV3Message, type ImpactVoucher } from "../src/lib/onchain.ts";

const SALE = "0x00000000000000000000000000000000000Ca1e3" as const;
const voucher: ImpactVoucher = {
  tokenId: 7n,
  creator: "0x1111111111111111111111111111111111111111",
  totalIV: 1234n * 10n ** 18n,
  maxEditions: 100n,
  pricePerEdition: 10_000_000n,
  currency: "0x2222222222222222222222222222222222222222",
  beneficiary: "0x3333333333333333333333333333333333333333",
  recipient: zeroAddress,
  easUID: "0x4444444444444444444444444444444444444444444444444444444444444444",
  metadataURI: "ipfs://bafy-fisherman's \"village\"",
  royaltyBps: 250n,
  feeBps: 250n,
  partner: "0x5555555555555555555555555555555555555555",
  partnerFeeBps: 500n,
  resaleFeeBps: 250n,
  resalePartnerBps: 250n,
  mintCap: 25n,
  nonce: 3n,
  deadline: 1_900_000_000n,
};

const digest = hashTypedData({
  domain: { name: "RegenPrimarySale", version: "3", chainId: 31337, verifyingContract: SALE },
  types: VOUCHER_TYPES_V3,
  primaryType: "Voucher",
  message: voucherV3Message(voucher),
});
const claimHash = keccak256(
  encodeImpactClaimV2(voucher.creator, voucher.totalIV, voucher.metadataURI, {
    proofLevel: 2,
    methodologyVersion: "v0.2",
    validator: "0x6666666666666666666666666666666666666666",
    partner: voucher.partner,
    transferable: true,
  }),
);

const EXPECTED_DIGEST: Hex = "0x7e67f565398588f74e89cc4adc7f9dbe8de0de1d712ace3d5b2ff8f9b0e3e098";
const EXPECTED_CLAIM: Hex = "0x492ab7ac6e0cba8713a2b96ece84ef22e10ca314227bfaf30b81f587d808f2d0";
console.log("voucher digest", digest);
console.log("claim hash    ", claimHash);
if ((digest !== EXPECTED_DIGEST || claimHash !== EXPECTED_CLAIM)) {
  console.error("MISMATCH with the contract test vector");
  process.exit(1);
}

// Live validation of the voucher flow against the build's NETWORK (see src/lib/networks.ts):
// EAS attest -> sign EIP-712 voucher -> (approve ERC-20) -> redeem (pay + lazy mint to buyer). Proves the
// off-chain signing matches RegenPrimarySale (redeem reverts BadSignature otherwise). Placeholder metadataURI.
//   NEXT_PUBLIC_NETWORK=arbitrum-sepolia OPERATOR_PRIVATE_KEY=0x.. TRWI_ADDRESS=0x.. \
//     node --import tsx scripts/test-v2-flow.ts
// With primarySaleVersion 2, PARTNER=0x.. PARTNER_FEE_BPS=500 tests the partner share (default: no partner).
import { createPublicClient, createWalletClient, http, zeroAddress, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { attestImpact, signVoucher, ivToWei, operatorAddress, type ImpactVoucher } from "../src/lib/onchain.ts";
import { getNetwork, NATIVE } from "../src/lib/networks.ts";
const NETWORK = getNetwork(process.env.NEXT_PUBLIC_NETWORK);
import { erc20Abi, redeemAbiV1, redeemAbiV2 } from "../src/lib/chain.ts";

const PRIMARY_SALE = NETWORK.primarySale;
const TRWI = process.env.TRWI_ADDRESS as Hex;
if (!TRWI) throw new Error("TRWI_ADDRESS not set");
const RPC = process.env.SERVER_RPC_URL || NETWORK.chain.rpcUrls.default.http[0];
const chain = NETWORK.chain;
const { address: currency, decimals, symbol } = NETWORK.saleCurrency;

const op = operatorAddress();
const iv = "292.5";
const metadataURI = "ipfs://v2-smoke-placeholder";

const { uid } = await attestImpact(NETWORK, op, iv, metadataURI);
console.log("attested uid:", uid);

const voucher: ImpactVoucher = {
  tokenId: BigInt(Math.floor(Date.now() / 1000)),
  creator: op,
  totalIV: ivToWei(iv),
  maxEditions: 100n,
  pricePerEdition: 10n ** BigInt(decimals - 2), // 0.01 of the sale currency
  currency,
  beneficiary: op,
  easUID: uid,
  metadataURI,
  royaltyBps: 500n,
  feeBps: 250n,
  partner: (process.env.PARTNER as Hex | undefined) ?? zeroAddress,
  partnerFeeBps: BigInt(process.env.PARTNER_FEE_BPS ?? "0"),
  nonce: 0n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
};
const sig = await signVoucher(NETWORK, voucher);
console.log("voucher signed for tokenId", voucher.tokenId.toString());

const trwiAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }, { name: "id", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "impactValueOf", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }, { name: "amt", type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;

const account = privateKeyToAccount(
  (process.env.OPERATOR_PRIVATE_KEY!.startsWith("0x") ? process.env.OPERATOR_PRIVATE_KEY! : `0x${process.env.OPERATOR_PRIVATE_KEY}`) as Hex,
);
const wallet = createWalletClient({ account, chain, transport: http(RPC) });
const pub = createPublicClient({ chain, transport: http(RPC) });

const amount = 10n;
const total = voucher.pricePerEdition * amount;
if (currency !== NATIVE) {
  const approveHash = await wallet.writeContract({
    address: currency, abi: erc20Abi, functionName: "approve", args: [PRIMARY_SALE, total], account, chain,
  });
  await pub.waitForTransactionReceipt({ hash: approveHash });
  console.log(`approved ${total} (${symbol} smallest units):`, approveHash);
}
const common = { address: PRIMARY_SALE, functionName: "redeem", value: currency === NATIVE ? total : 0n, account, chain } as const;
const { partner: _p, partnerFeeBps: _f, ...voucherV1 } = voucher;
const txHash =
  NETWORK.primarySaleVersion === 2
    ? await wallet.writeContract({ ...common, abi: redeemAbiV2, args: [voucher, amount, sig] })
    : await wallet.writeContract({ ...common, abi: redeemAbiV1, args: [voucherV1, amount, sig] });
const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
console.log("redeem tx:", txHash, "status:", receipt.status);

const bal = await pub.readContract({ address: TRWI, abi: trwiAbi, functionName: "balanceOf", args: [op, voucher.tokenId] });
const ivOf = await pub.readContract({ address: TRWI, abi: trwiAbi, functionName: "impactValueOf", args: [voucher.tokenId, 100n] });
console.log("buyer balance:", bal.toString(), "| impactValueOf(N):", ivOf.toString(), "(expect 292.5e18)");

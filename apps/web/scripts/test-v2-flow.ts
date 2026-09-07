// Live validation of the v2 voucher flow against the deployed Celo Sepolia contracts:
// EAS attest -> sign EIP-712 voucher -> redeem (pay + lazy mint to buyer). Proves the off-chain
// signing matches RegenPrimarySale (redeem reverts BadSignature otherwise). Placeholder metadataURI.
//   OPERATOR_PRIVATE_KEY=0x.. CELO_SEPOLIA_RPC_URL=.. node --import tsx scripts/test-v2-flow.ts
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { attestImpact, signVoucher, ivToWei, operatorAddress, celoSepolia, type ImpactVoucher } from "../src/lib/onchain.ts";

const PRIMARY_SALE = "0x49A5a77e3DBd76411737820fd968142b6154be26" as Hex;
const TRWI = "0x796B521EBF9221A0f4212C10767898AfCd81087d" as Hex;
const RPC = process.env.CELO_SEPOLIA_RPC_URL ?? "https://forno.celo-sepolia.celo-testnet.org";

const op = operatorAddress();
const iv = "292.5";
const metadataURI = "ipfs://v2-smoke-placeholder";

const { uid } = await attestImpact(op, iv, metadataURI);
console.log("attested uid:", uid);

const voucher: ImpactVoucher = {
  tokenId: BigInt(Math.floor(Date.now() / 1000)),
  creator: op,
  totalIV: ivToWei(iv),
  maxEditions: 100n,
  pricePerEdition: 10_000_000_000_000_000n, // 0.01 CELO
  currency: "0x0000000000000000000000000000000000000000" as Hex,
  beneficiary: op,
  easUID: uid,
  metadataURI,
  royaltyBps: 500n,
  feeBps: 250n,
  nonce: 0n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
};
const sig = await signVoucher(voucher);
console.log("voucher signed for tokenId", voucher.tokenId.toString());

const voucherComponents = [
  { name: "tokenId", type: "uint256" },
  { name: "creator", type: "address" },
  { name: "totalIV", type: "uint256" },
  { name: "maxEditions", type: "uint256" },
  { name: "pricePerEdition", type: "uint256" },
  { name: "currency", type: "address" },
  { name: "beneficiary", type: "address" },
  { name: "easUID", type: "bytes32" },
  { name: "metadataURI", type: "string" },
  { name: "royaltyBps", type: "uint96" },
  { name: "feeBps", type: "uint96" },
  { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint256" },
] as const;
const saleAbi = [
  {
    type: "function",
    name: "redeem",
    stateMutability: "payable",
    inputs: [
      { name: "v", type: "tuple", components: voucherComponents },
      { name: "amount", type: "uint256" },
      { name: "sig", type: "bytes" },
    ],
    outputs: [],
  },
] as const;
const trwiAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }, { name: "id", type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "impactValueOf", stateMutability: "view", inputs: [{ name: "id", type: "uint256" }, { name: "amt", type: "uint256" }], outputs: [{ type: "uint256" }] },
] as const;

const account = privateKeyToAccount(
  (process.env.OPERATOR_PRIVATE_KEY!.startsWith("0x") ? process.env.OPERATOR_PRIVATE_KEY! : `0x${process.env.OPERATOR_PRIVATE_KEY}`) as Hex,
);
const wallet = createWalletClient({ account, chain: celoSepolia, transport: http(RPC) });
const pub = createPublicClient({ chain: celoSepolia, transport: http(RPC) });

const amount = 10n;
const txHash = await wallet.writeContract({
  address: PRIMARY_SALE,
  abi: saleAbi,
  functionName: "redeem",
  args: [voucher, amount, sig],
  value: voucher.pricePerEdition * amount,
  account,
  chain: celoSepolia,
});
const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
console.log("redeem tx:", txHash, "status:", receipt.status);

const bal = await pub.readContract({ address: TRWI, abi: trwiAbi, functionName: "balanceOf", args: [op, voucher.tokenId] });
const ivOf = await pub.readContract({ address: TRWI, abi: trwiAbi, functionName: "impactValueOf", args: [voucher.tokenId, 100n] });
console.log("buyer balance:", bal.toString(), "| impactValueOf(N):", ivOf.toString(), "(expect 292.5e18)");

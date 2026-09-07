// On-chain wiring for Celo Sepolia (v2 — platform-issued lazy mint via vouchers). SERVER-ONLY.
// The platform operator (OPERATOR_PRIVATE_KEY) is both the EAS ATTESTER and the voucher SIGNER. It:
//  1) creates an EAS ImpactClaim attestation for a verified impact (provenance, source of truth), and
//  2) signs an EIP-712 ImpactVoucher (commercial terms) that a buyer redeems to lazily mint editions.
// The token (TRWI) is never minted server-side here — minting happens on buyer redeem (RegenPrimarySale).
//
// IV scale: on-chain impactValue = IV × 1e18 (parseUnits(iv, 18)) so the staking/fraction math is correct.

import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  encodeAbiParameters,
  parseUnits,
  parseEventLogs,
  zeroHash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = process.env.CELO_SEPOLIA_RPC_URL ?? "https://forno.celo-sepolia.celo-testnet.org";
// Public v3 (hardened) addresses (overridable via env); defaults = the live Celo Sepolia v3 deployment.
const EAS_ADDRESS = (process.env.EAS_ADDRESS ?? "0x82448c9c9b95Da5dCe9905F9C59CcCA0DF346df8") as Hex;
const PRIMARY_SALE_ADDRESS = (process.env.PRIMARY_SALE_ADDRESS ?? "0x2b4A3aE4E69771cdf2Fd4e2075A7B3Ab2e0498B2") as Hex;
const SCHEMA_UID = (process.env.IMPACT_CLAIM_SCHEMA_UID ??
  "0xc9c7678fbad9ec95e2ef6f480b10391bb7dcb1df7feec189411a439fd850f64e") as Hex;
const CHAIN_ID = 11142220;

export const celoSepolia = defineChain({
  id: CHAIN_ID,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://celo-sepolia.blockscout.com" } },
  testnet: true,
});

const easAbi = [
  {
    type: "function",
    name: "attest",
    stateMutability: "payable",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "schema", type: "bytes32" },
          {
            name: "data",
            type: "tuple",
            components: [
              { name: "recipient", type: "address" },
              { name: "expirationTime", type: "uint64" },
              { name: "revocable", type: "bool" },
              { name: "refUID", type: "bytes32" },
              { name: "data", type: "bytes" },
              { name: "value", type: "uint256" },
            ],
          },
        ],
      },
    ],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "event",
    name: "Attested",
    inputs: [
      { name: "recipient", type: "address", indexed: true },
      { name: "attester", type: "address", indexed: true },
      { name: "uid", type: "bytes32", indexed: false },
      { name: "schemaUID", type: "bytes32", indexed: true },
    ],
    anonymous: false,
  },
] as const;

// EIP-712 voucher type — MUST match RegenPrimarySale's VOUCHER_TYPEHASH field order.
const VOUCHER_TYPES = {
  Voucher: [
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
  ],
} as const;

export interface ImpactVoucher {
  tokenId: bigint;
  creator: Hex;
  totalIV: bigint;
  maxEditions: bigint;
  pricePerEdition: bigint;
  currency: Hex;
  beneficiary: Hex;
  easUID: Hex;
  metadataURI: string;
  royaltyBps: bigint;
  feeBps: bigint;
  nonce: bigint;
  deadline: bigint;
}

export function onchainEnabled(): boolean {
  return !!process.env.OPERATOR_PRIVATE_KEY;
}

function clients() {
  const pk = process.env.OPERATOR_PRIVATE_KEY;
  if (!pk) throw new Error("OPERATOR_PRIVATE_KEY not set");
  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Hex);
  const wallet = createWalletClient({ account, chain: celoSepolia, transport: http(RPC) });
  const pub = createPublicClient({ chain: celoSepolia, transport: http(RPC) });
  return { account, wallet, pub };
}

export function operatorAddress(): Hex {
  return clients().account.address;
}

/** Build the on-chain impactValue (IV scaled to 1e18) from the human IV decimal string. */
export function ivToWei(ivDecimal: string): bigint {
  return parseUnits(ivDecimal, 18);
}

/** Create an EAS ImpactClaim attestation (operator = authorized attester). Returns the UID + tx hash. */
export async function attestImpact(ngo: Hex, ivDecimal: string, metadataURI: string): Promise<{ uid: Hex; txHash: Hex }> {
  const { account, wallet, pub } = clients();
  const data = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }, { type: "string" }],
    [ngo, ivToWei(ivDecimal), metadataURI],
  );
  const txHash = await wallet.writeContract({
    address: EAS_ADDRESS,
    abi: easAbi,
    functionName: "attest",
    args: [{ schema: SCHEMA_UID, data: { recipient: ngo, expirationTime: 0n, revocable: true, refUID: zeroHash, data, value: 0n } }],
    account,
    chain: celoSepolia,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
  const logs = parseEventLogs({ abi: easAbi, eventName: "Attested", logs: receipt.logs });
  const uid = logs[0]?.args?.uid;
  if (!uid) throw new Error("attest: no UID in receipt logs");
  return { uid, txHash };
}

/** Sign an ImpactVoucher (EIP-712) with the operator key. The buyer redeems it at RegenPrimarySale. */
export async function signVoucher(v: ImpactVoucher): Promise<Hex> {
  const { account, wallet } = clients();
  return wallet.signTypedData({
    account,
    domain: { name: "RegenPrimarySale", version: "1", chainId: CHAIN_ID, verifyingContract: PRIMARY_SALE_ADDRESS },
    types: VOUCHER_TYPES,
    primaryType: "Voucher",
    message: v,
  });
}

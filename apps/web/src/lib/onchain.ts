// On-chain wiring per network (v2 — platform-issued lazy mint via vouchers). SERVER-ONLY.
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
  encodeAbiParameters,
  parseUnits,
  parseEventLogs,
  zeroAddress,
  zeroHash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import type { Network } from "./networks";

// Optional provider RPC per chain (RPC_URL_<chainId>); otherwise the network's public RPC.
function rpcFor(net: Network): string {
  return process.env[`RPC_URL_${net.chain.id}`] || net.chain.rpcUrls.default.http[0];
}

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

// EIP-712 voucher types — MUST match RegenPrimarySale's VOUCHER_TYPEHASH field order (v1 and v2 contracts).
const VOUCHER_FIELDS_HEAD = [
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
] as const;
const VOUCHER_FIELDS_TAIL = [
  { name: "nonce", type: "uint256" },
  { name: "deadline", type: "uint256" },
] as const;
const VOUCHER_TYPES_V1 = { Voucher: [...VOUCHER_FIELDS_HEAD, ...VOUCHER_FIELDS_TAIL] } as const;
const VOUCHER_TYPES_V2 = {
  Voucher: [
    ...VOUCHER_FIELDS_HEAD,
    { name: "partner", type: "address" },
    { name: "partnerFeeBps", type: "uint96" },
    ...VOUCHER_FIELDS_TAIL,
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
  // v2 only (partner share). Must be zero address / 0 when there is no partner.
  partner: Hex;
  partnerFeeBps: bigint;
  nonce: bigint;
  deadline: bigint;
}

export function onchainEnabled(): boolean {
  return !!process.env.OPERATOR_PRIVATE_KEY;
}

function operatorAccount() {
  const pk = process.env.OPERATOR_PRIVATE_KEY;
  if (!pk) throw new Error("OPERATOR_PRIVATE_KEY not set");
  return privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Hex);
}

function clients(net: Network) {
  const account = operatorAccount();
  const transport = http(rpcFor(net));
  const wallet = createWalletClient({ account, chain: net.chain, transport });
  const pub = createPublicClient({ chain: net.chain, transport });
  return { account, wallet, pub };
}

export function operatorAddress(): Hex {
  return operatorAccount().address;
}

/** Build the on-chain impactValue (IV scaled to 1e18) from the human IV decimal string. */
export function ivToWei(ivDecimal: string): bigint {
  return parseUnits(ivDecimal, 18);
}

/** Create an EAS ImpactClaim attestation (operator = authorized attester). Returns the UID + tx hash. */
export async function attestImpact(
  net: Network,
  ngo: Hex,
  ivDecimal: string,
  metadataURI: string,
): Promise<{ uid: Hex; txHash: Hex }> {
  const { account, wallet, pub } = clients(net);
  const data = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }, { type: "string" }],
    [ngo, ivToWei(ivDecimal), metadataURI],
  );
  const txHash = await wallet.writeContract({
    address: net.eas,
    abi: easAbi,
    functionName: "attest",
    args: [{ schema: net.schemaUID, data: { recipient: ngo, expirationTime: 0n, revocable: true, refUID: zeroHash, data, value: 0n } }],
    account,
    chain: net.chain,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
  const logs = parseEventLogs({ abi: easAbi, eventName: "Attested", logs: receipt.logs });
  const uid = logs[0]?.args?.uid;
  if (!uid) throw new Error("attest: no UID in receipt logs");
  return { uid, txHash };
}

/** True when `addr` is a contract on this network (a contract partner may reject native payouts). */
export async function hasCode(net: Network, addr: Hex): Promise<boolean> {
  const pub = createPublicClient({ chain: net.chain, transport: http(rpcFor(net)) });
  const code = await pub.getCode({ address: addr });
  return !!code && code !== "0x";
}

/**
 * Sign an ImpactVoucher (EIP-712) with the operator key. The buyer redeems it at RegenPrimarySale.
 * The network's primarySaleVersion picks the domain and field list; a v1 contract cannot pay a partner.
 */
export async function signVoucher(net: Network, v: ImpactVoucher): Promise<Hex> {
  const { account, wallet } = clients(net);
  const domain = {
    name: "RegenPrimarySale",
    version: String(net.primarySaleVersion),
    chainId: net.chain.id,
    verifyingContract: net.primarySale,
  };
  if (net.primarySaleVersion === 2) {
    return wallet.signTypedData({ account, domain, types: VOUCHER_TYPES_V2, primaryType: "Voucher", message: v });
  }
  if (v.partner !== zeroAddress || v.partnerFeeBps !== 0n) throw new Error("partner share needs RegenPrimarySale v2");
  const { partner: _p, partnerFeeBps: _f, ...v1 } = v;
  return wallet.signTypedData({ account, domain, types: VOUCHER_TYPES_V1, primaryType: "Voucher", message: v1 });
}

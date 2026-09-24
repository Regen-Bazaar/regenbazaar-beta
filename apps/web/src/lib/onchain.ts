// On-chain wiring for the build's NETWORK (v2 — platform-issued lazy mint via vouchers). SERVER-ONLY.
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
  zeroHash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

import { NETWORK } from "./networks";

// Server RPC may differ from the public one (e.g. a provider URL); addresses always come from NETWORK.
const RPC = process.env.SERVER_RPC_URL || NETWORK.chain.rpcUrls.default.http[0];
const EAS_ADDRESS = NETWORK.eas;
const PRIMARY_SALE_ADDRESS = NETWORK.primarySale;
const SCHEMA_UID = NETWORK.schemaUID;
const CHAIN = NETWORK.chain;

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
  const wallet = createWalletClient({ account, chain: CHAIN, transport: http(RPC) });
  const pub = createPublicClient({ chain: CHAIN, transport: http(RPC) });
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
    chain: CHAIN,
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
    domain: { name: "RegenPrimarySale", version: "1", chainId: CHAIN.id, verifyingContract: PRIMARY_SALE_ADDRESS },
    types: VOUCHER_TYPES,
    primaryType: "Voucher",
    message: v,
  });
}

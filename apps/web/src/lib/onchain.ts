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

import { NotSentError } from "./chain-errors";
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
// v3 (contract revision 4): MUST match RegenPrimarySaleV3.VOUCHER_TYPEHASH field order exactly.
export const VOUCHER_TYPES_V3 = {
  Voucher: [
    { name: "tokenId", type: "uint256" },
    { name: "creator", type: "address" },
    { name: "totalIV", type: "uint256" },
    { name: "maxEditions", type: "uint256" },
    { name: "pricePerEdition", type: "uint256" },
    { name: "currency", type: "address" },
    { name: "beneficiary", type: "address" },
    { name: "recipient", type: "address" },
    { name: "easUID", type: "bytes32" },
    { name: "metadataURI", type: "string" },
    { name: "royaltyBps", type: "uint96" },
    { name: "feeBps", type: "uint96" },
    { name: "partner", type: "address" },
    { name: "partnerFeeBps", type: "uint96" },
    { name: "resaleFeeBps", type: "uint96" },
    { name: "resalePartnerBps", type: "uint96" },
    { name: "mintCap", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/** ImpactClaim v2 attestation format (contract revision 4), registered by DeployRevision4. */
export const IMPACT_CLAIM_V2_SCHEMA =
  "address creator,uint256 impactValue,string metadataURI,uint8 proofLevel,string methodologyVersion,address validator,address partner,bool transferable";
const IMPACT_CLAIM_V2_PARAMS = [
  { type: "address" },
  { type: "uint256" },
  { type: "string" },
  { type: "uint8" },
  { type: "string" },
  { type: "address" },
  { type: "address" },
  { type: "bool" },
] as const;

/** Extra facts the v2 attestation carries (revision 4). The partner is fixed here for the impact's whole life. */
export interface ImpactClaimV2Extra {
  proofLevel: number; // 1..4 for P1..P4; 0 = not graded (methodology v0.1)
  methodologyVersion: string;
  validator: Hex; // the approving validator's sign-in wallet; zero address until validator accounts ship
  partner: Hex; // zero address = no partner
  transferable: boolean; // the site always sets true (non-transferable impact is built but switched off)
}

/** ABI payload of an ImpactClaim v2 attestation (flat encoding, as TRWIV4.decodeClaim reads it). */
export function encodeImpactClaimV2(creator: Hex, impactValueWei: bigint, metadataURI: string, x: ImpactClaimV2Extra): Hex {
  if (!Number.isInteger(x.proofLevel) || x.proofLevel < 0 || x.proofLevel > 4) throw new Error("proof level must be 0..4");
  return encodeAbiParameters(IMPACT_CLAIM_V2_PARAMS, [
    creator,
    impactValueWei,
    metadataURI,
    x.proofLevel,
    x.methodologyVersion,
    x.validator,
    x.partner,
    x.transferable,
  ]);
}
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
  // v3 only (revision 4). recipient zero = the payer; resale shares are fixed per impact at its first sale.
  recipient?: Hex;
  resaleFeeBps?: bigint;
  resalePartnerBps?: bigint;
  mintCap?: bigint; // editions that may exist after the purchase (edition limit: 25 while it holds, else maxEditions)
}

/** On-chain features are on when a signing key is configured: the shared operator key, or revision 4's signer. */
export function onchainEnabled(): boolean {
  return !!process.env.OPERATOR_PRIVATE_KEY || !!process.env.VOUCHER_SIGNER_PRIVATE_KEY;
}

function operatorAccount() {
  const pk = process.env.OPERATOR_PRIVATE_KEY;
  if (!pk) throw new Error("OPERATOR_PRIVATE_KEY not set");
  return privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Hex);
}

// Revision 4 separates the keys: the voucher signer and the attester are two server keys (contract-revision.md, 2).
function revision4Account(envKey: "VOUCHER_SIGNER_PRIVATE_KEY" | "ATTESTER_PRIVATE_KEY" | "WITHDRAWER_PRIVATE_KEY") {
  const pk = process.env[envKey];
  if (!pk) throw new Error(`${envKey} not set (needed for contract revision 4)`);
  return privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Hex);
}

const REVISION4_KEYS = {
  signer: "VOUCHER_SIGNER_PRIVATE_KEY",
  attester: "ATTESTER_PRIVATE_KEY",
  withdrawer: "WITHDRAWER_PRIVATE_KEY",
} as const;

function clients(net: Network, role: "signer" | "attester" | "withdrawer" = "signer") {
  if (role === "withdrawer" && net.primarySaleVersion !== 3) throw new Error("withdraw needs contract revision 4");
  const account = net.primarySaleVersion === 3 ? revision4Account(REVISION4_KEYS[role]) : operatorAccount();
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

/**
 * Create an EAS ImpactClaim attestation (operator = authorized attester). Returns the UID + tx hash.
 * On a revision 4 network (primarySaleVersion 3) the v2 format is written and `extra` is required.
 */
export async function attestImpact(
  net: Network,
  ngo: Hex,
  ivDecimal: string,
  metadataURI: string,
  extra?: ImpactClaimV2Extra,
): Promise<{ uid: Hex; txHash: Hex }> {
  const { account, wallet, pub } = clients(net, "attester");
  let data: Hex;
  if (net.primarySaleVersion === 3) {
    if (!extra) throw new Error("revision 4 attestation needs proof level, methodology, validator and partner");
    data = encodeImpactClaimV2(ngo, ivToWei(ivDecimal), metadataURI, extra);
  } else {
    data = encodeAbiParameters(
      [{ type: "address" }, { type: "uint256" }, { type: "string" }],
      [ngo, ivToWei(ivDecimal), metadataURI],
    );
  }
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
  if (net.primarySaleVersion === 3) {
    return wallet.signTypedData({ account, domain, types: VOUCHER_TYPES_V3, primaryType: "Voucher", message: voucherV3Message(v) });
  }
  if (net.primarySaleVersion === 2) {
    const { recipient: _r, resaleFeeBps: _rf, resalePartnerBps: _rp, mintCap: _mc, ...v2 } = v;
    return wallet.signTypedData({ account, domain, types: VOUCHER_TYPES_V2, primaryType: "Voucher", message: v2 });
  }
  if (v.partner !== zeroAddress || v.partnerFeeBps !== 0n) throw new Error("partner share needs RegenPrimarySale v2");
  const { partner: _p, partnerFeeBps: _f, recipient: _r, resaleFeeBps: _rf, resalePartnerBps: _rp, mintCap: _mc, ...v1 } = v;
  return wallet.signTypedData({ account, domain, types: VOUCHER_TYPES_V1, primaryType: "Voucher", message: v1 });
}

/** The v3 message with every field present (a missing resale share would sign a different voucher). */
export function voucherV3Message(v: ImpactVoucher) {
  if (v.resaleFeeBps === undefined || v.resalePartnerBps === undefined) throw new Error("v3 voucher needs resale shares");
  if (v.mintCap === undefined || v.mintCap <= 0n || v.mintCap > v.maxEditions) throw new Error("v3 voucher needs a mint cap of 1..maxEditions");
  if (v.partner === zeroAddress && v.resalePartnerBps !== 0n) throw new Error("resale partner share without a partner");
  return { ...v, recipient: v.recipient ?? zeroAddress, resaleFeeBps: v.resaleFeeBps, resalePartnerBps: v.resalePartnerBps, mintCap: v.mintCap };
}

// ---- revision 4: withdraw a false claim, revoke its attestation, read minted editions ----

const trwiV4Abi = [
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [{ name: "easUID", type: "bytes32" }, { name: "reasonURI", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawnUID",
    stateMutability: "view",
    inputs: [{ name: "", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "collection",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "totalIV", type: "uint256" },
          { name: "maxEditions", type: "uint256" },
          { name: "minted", type: "uint256" },
          { name: "easUID", type: "bytes32" },
          { name: "partner", type: "address" },
          { name: "validator", type: "address" },
          { name: "proofLevel", type: "uint8" },
          { name: "transferable", type: "bool" },
          { name: "royaltyBps", type: "uint96" },
          { name: "resaleFeeBps", type: "uint96" },
          { name: "resalePartnerBps", type: "uint96" },
          { name: "methodologyVersion", type: "string" },
        ],
      },
    ],
  },
] as const;

const easGetAttestationAbi = [
  {
    type: "function",
    name: "getAttestation",
    stateMutability: "view",
    inputs: [{ name: "uid", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "uid", type: "bytes32" },
          { name: "schema", type: "bytes32" },
          { name: "time", type: "uint64" },
          { name: "expirationTime", type: "uint64" },
          { name: "revocationTime", type: "uint64" },
          { name: "refUID", type: "bytes32" },
          { name: "recipient", type: "address" },
          { name: "attester", type: "address" },
          { name: "revocable", type: "bool" },
          { name: "data", type: "bytes" },
        ],
      },
    ],
  },
] as const;

const easRevokeAbi = [
  {
    type: "function",
    name: "revoke",
    stateMutability: "payable",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "schema", type: "bytes32" },
          { name: "data", type: "tuple", components: [{ name: "uid", type: "bytes32" }, { name: "value", type: "uint256" }] },
        ],
      },
    ],
    outputs: [],
  },
] as const;

function requireRevision4(net: Network) {
  if (net.primarySaleVersion !== 3) throw new Error(`${net.chain.name} is not on contract revision 4`);
}

/** Editions already minted for `tokenId` on TRWIV4 (0 before the first sale). */
export async function mintedOnChain(net: Network, tokenId: bigint): Promise<bigint> {
  requireRevision4(net);
  const pub = createPublicClient({ chain: net.chain, transport: http(rpcFor(net)) });
  const c = await pub.readContract({ address: net.trwi, abi: trwiV4Abi, functionName: "collection", args: [tokenId] });
  return c.minted;
}

/**
 * Send TRWIV4.withdraw (WITHDRAWER key) without waiting for it. Null when the impact is already marked, so a
 * retry never sends a second transaction. The caller saves the hash, then calls waitForTx.
 */
export async function sendWithdraw(net: Network, easUid: Hex, reasonURI: string): Promise<Hex | null> {
  requireRevision4(net);
  const { account, wallet, pub } = clients(net, "withdrawer");
  const request = await notSent(async () => {
    const done = await pub.readContract({ address: net.trwi, abi: trwiV4Abi, functionName: "withdrawnUID", args: [easUid] });
    if (done) return null;
    const sim = await pub.simulateContract({ address: net.trwi, abi: trwiV4Abi, functionName: "withdraw", args: [easUid, reasonURI], account, chain: net.chain });
    return sim.request;
  });
  return request && wallet.writeContract(request);
}

/** Send the EAS revoke (ATTESTER key, the original attester) without waiting. Null when already revoked. */
export async function sendRevoke(net: Network, easUid: Hex): Promise<Hex | null> {
  requireRevision4(net);
  const { account, wallet, pub } = clients(net, "attester");
  const request = await notSent(async () => {
    const att = await pub.readContract({ address: net.eas, abi: easGetAttestationAbi, functionName: "getAttestation", args: [easUid] });
    if (att.revocationTime !== 0n) return null;
    const sim = await pub.simulateContract({
      address: net.eas,
      abi: easRevokeAbi,
      functionName: "revoke",
      args: [{ schema: net.schemaUID, data: { uid: easUid, value: 0n } }],
      account,
      chain: net.chain,
    });
    return sim.request;
  });
  return request && wallet.writeContract(request);
}

/** Run the steps before a send; any failure there is a NotSentError (nothing reached the network). */
async function notSent<T>(f: () => Promise<T>): Promise<T> {
  try {
    return await f();
  } catch (e) {
    throw new NotSentError(e);
  }
}

/** Read-only: is the withdrawal step already in place on-chain (TRWIV4 mark or EAS revocation)? */
export async function isStepDone(net: Network, easUid: Hex, step: "withdraw" | "revoke"): Promise<boolean> {
  requireRevision4(net);
  const pub = createPublicClient({ chain: net.chain, transport: http(rpcFor(net)) });
  if (step === "withdraw") {
    return pub.readContract({ address: net.trwi, abi: trwiV4Abi, functionName: "withdrawnUID", args: [easUid] });
  }
  const att = await pub.readContract({ address: net.eas, abi: easGetAttestationAbi, functionName: "getAttestation", args: [easUid] });
  return att.revocationTime !== 0n;
}

/** Wait (at most 5 minutes, well inside the approval lease) for a sent transaction; "reverted" if it failed. */
export async function waitForTx(net: Network, hash: Hex): Promise<"success" | "reverted"> {
  const pub = createPublicClient({ chain: net.chain, transport: http(rpcFor(net)) });
  const r = await pub.waitForTransactionReceipt({ hash, timeout: 300_000 });
  return r.status === "success" ? "success" : "reverted";
}

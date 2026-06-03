// On-chain wiring for Celo Sepolia: create an EAS ImpactClaim attestation, then mint the tRWI.
// SERVER-ONLY (uses OPERATOR_PRIVATE_KEY = the TOKENIZER+ATTESTER key). Never import from client code.
//
// IV scale: the engine's Impact Value is a human decimal (e.g. "515.2583"); on-chain impactValue is
// scaled to 1e18 (parseUnits(iv, 18)) so the staking reward math (1e18-based) is correct.

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
// Public addresses (overridable via env); defaults = the live Celo Sepolia deployment.
const EAS_ADDRESS = (process.env.EAS_ADDRESS ?? "0x142dFB78c9DFDb447Fad7e327B139Bb622c81c1c") as Hex;
const TRWI_ADDRESS = (process.env.TRWI_ADDRESS ?? "0xa511F92336d9DcBe62caEA46F82DcaFa82BC3E65") as Hex;
const SCHEMA_UID = (process.env.IMPACT_CLAIM_SCHEMA_UID ??
  "0x836d37174fff1eb2e5a2af8d20d87a908283eec088e38cf21cedaaa9a2658633") as Hex;

export const celoSepolia = defineChain({
  id: 11142220,
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

const trwiAbi = [
  {
    type: "function",
    name: "mintImpact",
    stateMutability: "nonpayable",
    inputs: [
      { name: "easUID", type: "bytes32" },
      { name: "editions", type: "uint256" },
      { name: "royaltyReceiver", type: "address" },
      { name: "royaltyBps", type: "uint96" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "event",
    name: "ImpactTokenized",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "totalIV", type: "uint256", indexed: false },
      { name: "editions", type: "uint256", indexed: false },
      { name: "easUID", type: "bytes32", indexed: true },
      { name: "uri", type: "string", indexed: false },
    ],
    anonymous: false,
  },
] as const;

/** True when the server is configured to perform on-chain attest+mint. */
export function onchainEnabled(): boolean {
  return !!process.env.OPERATOR_PRIVATE_KEY;
}

export const impactClaimSchemaUid = SCHEMA_UID;

/** The operator (attester/tokenizer) address derived from OPERATOR_PRIVATE_KEY. */
export function operatorAddress(): Hex {
  return clients().account.address;
}

function clients() {
  const pk = process.env.OPERATOR_PRIVATE_KEY;
  if (!pk) throw new Error("OPERATOR_PRIVATE_KEY not set");
  const account = privateKeyToAccount((pk.startsWith("0x") ? pk : `0x${pk}`) as Hex);
  const wallet = createWalletClient({ account, chain: celoSepolia, transport: http(RPC) });
  const pub = createPublicClient({ chain: celoSepolia, transport: http(RPC) });
  return { account, wallet, pub };
}

/** Create the EAS ImpactClaim attestation. `ivDecimal` is the human IV string (scaled to 1e18 here). */
export async function attestImpact(ngo: Hex, ivDecimal: string, metadataURI: string): Promise<{ uid: Hex; txHash: Hex }> {
  const { account, wallet, pub } = clients();
  const data = encodeAbiParameters(
    [{ type: "address" }, { type: "uint256" }, { type: "string" }],
    [ngo, parseUnits(ivDecimal, 18), metadataURI],
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

/** Mint fractional tRWI editions for a verified, attested impact. Returns the on-chain token id. */
export async function mintImpact(
  easUID: Hex,
  ngo: Hex,
  editions = 100n,
  royaltyBps = 500,
): Promise<{ tokenId: bigint; txHash: Hex }> {
  const { account, wallet, pub } = clients();
  const txHash = await wallet.writeContract({
    address: TRWI_ADDRESS,
    abi: trwiAbi,
    functionName: "mintImpact",
    args: [easUID, editions, ngo, BigInt(royaltyBps)],
    account,
    chain: celoSepolia,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash: txHash });
  const logs = parseEventLogs({ abi: trwiAbi, eventName: "ImpactTokenized", logs: receipt.logs });
  const tokenId = logs[0]?.args?.id;
  if (tokenId === undefined) throw new Error("mintImpact: no token id in receipt logs");
  return { tokenId, txHash };
}

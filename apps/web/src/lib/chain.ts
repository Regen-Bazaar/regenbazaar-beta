// Client-safe chain + public contract addresses (NO private keys — usable in the browser).
import { defineChain } from "viem";

export const RPC = process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC ?? "https://forno.celo-sepolia.celo-testnet.org";

export const celoSepolia = defineChain({
  id: 11142220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://celo-sepolia.blockscout.com" } },
  testnet: true,
});

export const PRIMARY_SALE = (process.env.NEXT_PUBLIC_PRIMARY_SALE ??
  "0x49A5a77e3DBd76411737820fd968142b6154be26") as `0x${string}`;

export const NATIVE = "0x0000000000000000000000000000000000000000" as const;

// RegenPrimarySale.redeem ABI (Voucher tuple must match the contract field order).
export const redeemAbi = [
  {
    type: "function",
    name: "redeem",
    stateMutability: "payable",
    inputs: [
      {
        name: "v",
        type: "tuple",
        components: [
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
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "amount", type: "uint256" },
      { name: "sig", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

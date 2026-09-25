// Client-safe chain + public contract addresses (NO private keys — usable in the browser).
import { NETWORK } from "./networks";

export { NATIVE } from "./networks";
export const chain = NETWORK.chain;
export const RPC = NETWORK.chain.rpcUrls.default.http[0];
export const PRIMARY_SALE = NETWORK.primarySale;
export const SALE_CURRENCY = NETWORK.saleCurrency;
export const TRWI = NETWORK.trwi;

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
          { name: "feeBps", type: "uint96" },
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

export const erc20Abi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const trwiAbi = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }, { name: "id", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "impactValueOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "retire",
    stateMutability: "nonpayable",
    inputs: [{ name: "tokenId", type: "uint256" }, { name: "amount", type: "uint256" }],
    outputs: [],
  },
] as const;

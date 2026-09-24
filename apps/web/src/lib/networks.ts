// Network registry (client-safe: public addresses only, NO keys). One build targets one network,
// chosen by NEXT_PUBLIC_NETWORK at build time (inlined into both server and browser bundles).
// Addresses default to the committed deployments (packages/contracts/deployments/*.json) and can be
// overridden per env for a redeploy without a code change.
import { defineChain, type Chain } from "viem";

type Hex = `0x${string}`;

export const NATIVE = "0x0000000000000000000000000000000000000000" as const;

export interface SaleCurrency {
  address: Hex; // NATIVE or an ERC-20 allowlisted on RegenPrimarySale
  symbol: string;
  decimals: number;
}

export interface Network {
  key: NetworkKey;
  chain: Chain;
  eas: Hex;
  schemaUID: Hex;
  primarySale: Hex;
  saleCurrency: SaleCurrency;
}

export type NetworkKey = "celo-sepolia" | "arbitrum-sepolia";

function celoSepolia(): Network {
  const rpc = process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC ?? "https://forno.celo-sepolia.celo-testnet.org";
  return {
    key: "celo-sepolia",
    chain: defineChain({
      id: 11142220,
      name: "Celo Sepolia",
      nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
      rpcUrls: { default: { http: [rpc] } },
      blockExplorers: { default: { name: "Blockscout", url: "https://celo-sepolia.blockscout.com" } },
      testnet: true,
    }),
    eas: "0x82448c9c9b95Da5dCe9905F9C59CcCA0DF346df8",
    schemaUID: "0xc9c7678fbad9ec95e2ef6f480b10391bb7dcb1df7feec189411a439fd850f64e",
    primarySale: "0x2b4A3aE4E69771cdf2Fd4e2075A7B3Ab2e0498B2",
    saleCurrency: { address: NATIVE, symbol: "CELO", decimals: 18 },
  };
}

function arbitrumSepolia(): Network {
  const rpc = process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC ?? "https://sepolia-rollup.arbitrum.io/rpc";
  return {
    key: "arbitrum-sepolia",
    chain: defineChain({
      id: 421614,
      name: "Arbitrum Sepolia",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpc] } },
      blockExplorers: { default: { name: "Blockscout", url: "https://arbitrum-sepolia.blockscout.com" } },
      testnet: true,
    }),
    eas: "0x95cD0E3bDbC670e057416D65C89B584a9a24d95d",
    schemaUID: "0xa702ff6a03caf077d7c3d9631cca826721f83f0b62c7d9c73640bf2bb749d983",
    primarySale: "0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030",
    // Paxos Global Dollar (USDG) testnet token — docs.paxos.com/guides/stablecoin/usdg/testnet
    saleCurrency: { address: "0xFFC95faa3d63Cde504a05B567C600B78C0b41892", symbol: "USDG", decimals: 6 },
  };
}

function resolve(): Network {
  const key = (process.env.NEXT_PUBLIC_NETWORK ?? "arbitrum-sepolia") as NetworkKey;
  const n = key === "celo-sepolia" ? celoSepolia() : arbitrumSepolia();
  return {
    ...n,
    eas: (process.env.NEXT_PUBLIC_EAS_ADDRESS as Hex | undefined) ?? n.eas,
    schemaUID: (process.env.NEXT_PUBLIC_IMPACT_CLAIM_SCHEMA_UID as Hex | undefined) ?? n.schemaUID,
    primarySale: (process.env.NEXT_PUBLIC_PRIMARY_SALE as Hex | undefined) ?? n.primarySale,
  };
}

export const NETWORK: Network = resolve();

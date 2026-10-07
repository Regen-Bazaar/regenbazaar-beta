// Network registry (client-safe: public addresses only, NO keys). One site serves every enabled network; the
// visitor's choice lives in the `rb_network` cookie (server: lib/network-server.ts, client: NetworkProvider).
// Addresses are the committed deployments (packages/contracts/deployments/*.json).
import { defineChain, type Chain } from "viem";

type Hex = `0x${string}`;

export const NATIVE = "0x0000000000000000000000000000000000000000" as const;

export interface SaleCurrency {
  address: Hex; // NATIVE or an ERC-20 allowlisted on RegenPrimarySale
  symbol: string;
  decimals: number;
  testMint?: boolean; // testnet stand-in token with a public mint() (demo buyers can fund themselves)
}

/**
 * USD value of one unit of the sale currency, used to turn a v0.2 USD price into a token amount.
 * USDG / tUSDG are dollar stablecoins (1). Test CELO has no market value; on the test network it is counted
 * as $1 so prices stay comparable. Mainnet primary sales settle in a stablecoin (decision D4).
 */
export function usdPerUnit(_currency: SaleCurrency): number {
  return 1;
}

export interface Network {
  key: NetworkKey;
  chain: Chain;
  appUrl: string; // public deployment of the app for this network (for the network switcher)
  eas: Hex;
  schemaUID: Hex;
  primarySale: Hex;
  // RegenPrimarySale voucher version at `primarySale`: 1 = no partner share, 2 = partner share (EIP-712 domain "2").
  // Flip to 2 together with the v2 address after the redeploy (docs/AUDIT.md, 2026-09-27).
  primarySaleVersion: 1 | 2;
  trwi: Hex;
  saleCurrency: SaleCurrency;
}

export type NetworkKey = "celo-sepolia" | "arbitrum-sepolia" | "robinhood-testnet" | "arc-mainnet";

function celoSepolia(): Network {
  const rpc = process.env.NEXT_PUBLIC_CELO_SEPOLIA_RPC ?? "https://forno.celo-sepolia.celo-testnet.org";
  return {
    key: "celo-sepolia",
    appUrl: "",
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
    primarySale: "0x02f8F96aDFCBF07b4D028318eBD76bf8e4D24f76", // v2 (partner share), 2026-10-06
    primarySaleVersion: 2,
    trwi: "0xA1A10570534681606eF67Bc8DDeda6061Dd8a8f0",
    saleCurrency: { address: NATIVE, symbol: "CELO", decimals: 18 },
  };
}

function arbitrumSepolia(): Network {
  const rpc = process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC ?? "https://sepolia-rollup.arbitrum.io/rpc";
  return {
    key: "arbitrum-sepolia",
    appUrl: "https://app.regenbazaar.com",
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
    primarySale: "0xf405669244d45E1C9d65C4af059921Dde76493F4", // v2 (partner share), 2026-10-06
    primarySaleVersion: 2,
    trwi: "0x6F2C6F81DDd35199d2e015710c61CC6D8B5de9da",
    // NEXT_PUBLIC_SALE_CURRENCY=tUSDG switches to the stand-in while the Paxos testnet faucet is not
    // dispensing; both tokens are allowlisted on RegenPrimarySale.
    saleCurrency:
      process.env.NEXT_PUBLIC_SALE_CURRENCY === "tUSDG"
        ? // TestUSDG (packages/contracts/src/testnet): same interface as USDG, NOT issued by Paxos.
          { address: "0x738B0C655E050320764EA1A7191BEA226B053410", symbol: "tUSDG", decimals: 6, testMint: true }
        : // Paxos Global Dollar (USDG) testnet token — docs.paxos.com/guides/stablecoin/usdg/testnet
          { address: "0xFFC95faa3d63Cde504a05B567C600B78C0b41892", symbol: "USDG", decimals: 6 },
  };
}

function robinhoodTestnet(): Network {
  const rpc = process.env.NEXT_PUBLIC_ROBINHOOD_TESTNET_RPC ?? "https://rpc.testnet.chain.robinhood.com";
  return {
    key: "robinhood-testnet",
    appUrl: "https://robinhood.regenbazaar.com",
    chain: defineChain({
      id: 46630,
      name: "Robinhood Chain Testnet",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpc] } },
      blockExplorers: { default: { name: "Blockscout", url: "https://explorer.testnet.chain.robinhood.com" } },
      testnet: true,
    }),
    eas: "0x95cD0E3bDbC670e057416D65C89B584a9a24d95d",
    schemaUID: "0xa702ff6a03caf077d7c3d9631cca826721f83f0b62c7d9c73640bf2bb749d983",
    primarySale: "0x7E8bE9B2278EF55c3C05316035d0F9BA35757FCf", // v2 (partner share), 2026-10-06
    primarySaleVersion: 2,
    trwi: "0x6F2C6F81DDd35199d2e015710c61CC6D8B5de9da",
    // Paxos Global Dollar (USDG) on Robinhood Chain testnet (the Paxos faucet dispenses here).
    saleCurrency: { address: "0x7E955252E15c84f5768B83c41a71F9eba181802F", symbol: "USDG", decimals: 6 },
  };
}

// Arc mainnet: REAL USDC. Market-only deployment (packages/contracts/deployments/arc-mainnet.json). Link-only:
// reachable via ?network=arc-mainnet, not offered in the switcher (owner decision 2026-10-07).
function arcMainnet(): Network {
  const rpc = process.env.NEXT_PUBLIC_ARC_MAINNET_RPC ?? "https://rpc.mainnet.arc.io";
  return {
    key: "arc-mainnet",
    appUrl: "",
    chain: defineChain({
      id: 5042,
      name: "Arc",
      // Gas is native USDC with 18 decimals; transfers go through the 6-decimals ERC-20 view below.
      nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
      rpcUrls: { default: { http: [rpc] } },
      blockExplorers: { default: { name: "Arcscan", url: "https://explorer.arc.io" } },
      testnet: false,
    }),
    eas: "0x6446Cf9161F58A3FadEf2f3711265054c5DA84aC",
    schemaUID: "0xfe0a11249a41ddf3f879036e89b0c82d2e954b625467cb189461b0897494e2fc",
    primarySale: "0x1D4513a40a8DF2046899d72a6634c8eEa9ffbDdE",
    primarySaleVersion: 2,
    trwi: "0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030",
    // Circle USDC (ERC-20 interface of native USDC), docs.arc.io/arc/references/contract-addresses
    saleCurrency: { address: "0x3600000000000000000000000000000000000000", symbol: "USDC", decimals: 6 },
  };
}

const BUILDERS: Record<NetworkKey, () => Network> = {
  "celo-sepolia": celoSepolia,
  "arbitrum-sepolia": arbitrumSepolia,
  "robinhood-testnet": robinhoodTestnet,
  "arc-mainnet": arcMainnet,
};

/** Networks offered in the site's network switcher. Each report is listed on ONE of them (chosen at submission). */
export const ENABLED_NETWORKS: NetworkKey[] = ["arbitrum-sepolia", "robinhood-testnet", "celo-sepolia"];
/** Selectable only by link (?network=<key>), never listed in the switcher or the network counts. */
export const LINK_ONLY_NETWORKS: NetworkKey[] = ["arc-mainnet"];
export const DEFAULT_NETWORK_KEY: NetworkKey = "arbitrum-sepolia";
export const NETWORK_COOKIE = "rb_network";

export function isNetworkKey(v: unknown): v is NetworkKey {
  return typeof v === "string" && ([...ENABLED_NETWORKS, ...LINK_ONLY_NETWORKS] as string[]).includes(v);
}

/** Resolve a (possibly untrusted) key to an enabled network; unknown -> default. */
export function getNetwork(key?: string | null): Network {
  return BUILDERS[isNetworkKey(key) ? key : DEFAULT_NETWORK_KEY]();
}

export function networkByChainId(chainId: number): Network | undefined {
  return (Object.keys(BUILDERS) as NetworkKey[]).map((k) => BUILDERS[k]()).find((n) => n.chain.id === chainId);
}

export function enabledNetworks(): Network[] {
  return ENABLED_NETWORKS.map((k) => BUILDERS[k]());
}

/** Every selectable network, link-only ones included (wallet config, approvals). */
export function allNetworks(): Network[] {
  return [...ENABLED_NETWORKS, ...LINK_ONLY_NETWORKS].map((k) => BUILDERS[k]());
}

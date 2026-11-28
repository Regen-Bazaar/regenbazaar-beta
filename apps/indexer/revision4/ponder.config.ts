// Ponder config for contract revision 4 (TRWIV4, RegenPrimarySaleV3, RegenMarketplaceV2). Its own Ponder root, so
// the live indexer (apps/indexer) keeps its build id and schema until the switch. One network per process.
// Run: pnpm --filter indexer start:revision4 -- --schema indexer_<net>_r4   (a NEW schema name per network)
import { createConfig } from "ponder";
import { http } from "viem";
import { TRWIV4Abi, PrimarySaleV3Abi, MarketplaceV2Abi } from "./src/abis";

const DEFAULT_RPC: Record<number, string> = {
  421614: "https://sepolia-rollup.arbitrum.io/rpc",
  11142220: "https://forno.celo-sepolia.celo-testnet.org",
  46630: "https://rpc.testnet.chain.robinhood.com",
};
const chainId = Number(process.env.PONDER_CHAIN_ID ?? 421614);
const rpc = process.env.PONDER_RPC_URL || DEFAULT_RPC[chainId];
if (!rpc) throw new Error(`no RPC for chain ${chainId}: set PONDER_RPC_URL`);
const startBlock = Number(process.env.R4_START_BLOCK ?? 0);

function addr(key: string): `0x${string}` {
  const v = process.env[key];
  if (!v || !/^0x[0-9a-fA-F]{40}$/.test(v)) throw new Error(`${key} must be the revision 4 contract address`);
  return v as `0x${string}`;
}

export default createConfig({
  networks: {
    chain: { chainId, transport: http(rpc) },
  },
  contracts: {
    TRWIV4: { network: "chain", abi: TRWIV4Abi, address: addr("R4_TRWI_ADDRESS"), startBlock },
    RegenPrimarySaleV3: { network: "chain", abi: PrimarySaleV3Abi, address: addr("R4_PRIMARY_SALE_ADDRESS"), startBlock },
    RegenMarketplaceV2: { network: "chain", abi: MarketplaceV2Abi, address: addr("R4_MARKETPLACE_ADDRESS"), startBlock },
  },
});

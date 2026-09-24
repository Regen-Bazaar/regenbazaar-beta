// Ponder config — one network per deployment (default Arbitrum Sepolia; Celo Sepolia via env).
// Chain id, RPC, addresses and start blocks all come from env; nothing chain-specific is hardcoded here.
import { createConfig } from "ponder";
import { http } from "viem";
import { TRWIAbi, PrimarySaleAbi, TRWIStakingAbi } from "./src/abis";

const DEFAULT_RPC: Record<number, string> = {
  421614: "https://sepolia-rollup.arbitrum.io/rpc",
  11142220: "https://forno.celo-sepolia.celo-testnet.org",
};
const chainId = Number(process.env.PONDER_CHAIN_ID ?? 421614);
const rpc = process.env.PONDER_RPC_URL || DEFAULT_RPC[chainId];
if (!rpc) throw new Error(`no RPC for chain ${chainId}: set PONDER_RPC_URL`);

export default createConfig({
  networks: {
    chain: { chainId, transport: http(rpc) },
  },
  contracts: {
    TRWI: {
      network: "chain",
      abi: TRWIAbi,
      address: process.env.TRWI_ADDRESS as `0x${string}`,
      startBlock: Number(process.env.TRWI_START_BLOCK ?? 0),
    },
    RegenPrimarySale: {
      network: "chain",
      abi: PrimarySaleAbi,
      address: process.env.PRIMARY_SALE_ADDRESS as `0x${string}`,
      startBlock: Number(process.env.TRWI_START_BLOCK ?? 0),
    },
    TRWIStaking: {
      network: "chain",
      abi: TRWIStakingAbi,
      address: process.env.STAKING_ADDRESS as `0x${string}`,
      startBlock: Number(process.env.STAKING_START_BLOCK ?? 0),
    },
  },
});

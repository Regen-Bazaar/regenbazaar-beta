// Ponder config — Celo Sepolia. Addresses + start blocks come from env (filled after contract deploy).
// Verify this API against the Ponder version you install (see README).
import { createConfig } from "ponder";
import { http } from "viem";
import { TRWIAbi, TRWIStakingAbi } from "./src/abis";

export default createConfig({
  networks: {
    celoSepolia: {
      chainId: 11142220,
      transport: http(process.env.PONDER_RPC_URL_11142220 ?? "https://forno.celo-sepolia.celo-testnet.org"),
    },
  },
  contracts: {
    TRWI: {
      network: "celoSepolia",
      abi: TRWIAbi,
      address: process.env.TRWI_ADDRESS as `0x${string}`,
      startBlock: Number(process.env.TRWI_START_BLOCK ?? 0),
    },
    TRWIStaking: {
      network: "celoSepolia",
      abi: TRWIStakingAbi,
      address: process.env.STAKING_ADDRESS as `0x${string}`,
      startBlock: Number(process.env.STAKING_START_BLOCK ?? 0),
    },
  },
});

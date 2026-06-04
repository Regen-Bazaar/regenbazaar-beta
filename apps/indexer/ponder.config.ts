// Ponder config — Celo Sepolia v2 (platform-issued lazy mint). Addresses + start blocks from env.
import { createConfig } from "ponder";
import { http } from "viem";
import { TRWIAbi, PrimarySaleAbi, TRWIStakingAbi } from "./src/abis";

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
    RegenPrimarySale: {
      network: "celoSepolia",
      abi: PrimarySaleAbi,
      address: process.env.PRIMARY_SALE_ADDRESS as `0x${string}`,
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

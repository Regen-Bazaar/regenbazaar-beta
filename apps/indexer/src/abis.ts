// Event ABIs for the indexer. These are minimal event-only fragments matching the contracts in
// packages/contracts. On activation, REPLACE these with the full `.abi` arrays produced by
// `forge build` (packages/contracts/out/TRWI.sol/TRWI.json → .abi, etc.) so all functions/errors are present.

export const TRWIAbi = [
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
  {
    type: "event",
    name: "ImpactRetired",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "holder", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "ivRetired", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

export const TRWIStakingAbi = [
  {
    type: "event",
    name: "Staked",
    inputs: [
      { name: "stakeId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "ivStaked", type: "uint256", indexed: false },
      { name: "lockEnd", type: "uint64", indexed: false },
      { name: "multiplierBps", type: "uint32", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "stakeId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "reward", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Unstaked",
    inputs: [
      { name: "stakeId", type: "uint256", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: false },
      { name: "amount", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

// Event ABIs for the v2 indexer. Replace with full forge `out/` ABIs on activation if you need more.

export const TRWIAbi = [
  {
    type: "event",
    name: "CollectionRegistered",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "totalIV", type: "uint256", indexed: false },
      { name: "maxEditions", type: "uint256", indexed: false },
      { name: "easUID", type: "bytes32", indexed: true },
      { name: "uri", type: "string", indexed: false },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ImpactMinted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "easUID", type: "bytes32", indexed: true },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "ImpactRetired",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "holder", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "ivRetired", type: "uint256", indexed: false },
    ],
    anonymous: false,
  },
] as const;

export const PrimarySaleAbi = [
  {
    type: "event",
    name: "Sold",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "total", type: "uint256", indexed: false },
      { name: "currency", type: "address", indexed: false },
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

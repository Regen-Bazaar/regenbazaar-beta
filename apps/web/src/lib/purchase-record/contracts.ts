// Every contract the purchase record job reads, on every network, with the block it was deployed at.
// Kept apart from networks.ts on purpose: networks.ts holds only the contracts the site sells on today, and the
// record needs the earlier and the not-yet-switched ones too (first sale contract, revision 4). Public addresses
// only (packages/contracts/deployments/*.json). When a network switches contracts, add the new ones here.

export type Hex = `0x${string}`;

export interface RecordedContract {
  address: Hex; // lowercase
  role: "token" | "sale";
  token: Hex; // lowercase tRWI contract the editions belong to (a token contract names itself)
  generation: 3 | 4; // matches listings.contract_generation
  startBlock: number;
}

export interface RecordedCurrency {
  address: Hex; // lowercase; zero address = native coin
  symbol: string;
  decimals: number;
}

export interface RecordedChain {
  chainId: number;
  maxRange: number; // widest block range the network's public connection answers in one request
  // Blocks the job stays behind the newest one (about 40 seconds on each network): public connections are
  // served by several nodes, and one that lags would answer "no events" for blocks it has not seen yet.
  confirmations: number;
  contracts: RecordedContract[];
  currencies: RecordedCurrency[];
}

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const lower = (a: string) => a.toLowerCase() as Hex;

function token(address: string, generation: 3 | 4, startBlock: number): RecordedContract {
  return { address: lower(address), role: "token", token: lower(address), generation, startBlock };
}
function sale(address: string, tokenAddress: string, generation: 3 | 4, startBlock: number): RecordedContract {
  return { address: lower(address), role: "sale", token: lower(tokenAddress), generation, startBlock };
}
function coin(address: string, symbol: string, decimals: number): RecordedCurrency {
  return { address: lower(address), symbol, decimals };
}

const ARB_TRWI = "0x6F2C6F81DDd35199d2e015710c61CC6D8B5de9da";
const ARB_TRWI_V4 = "0xa46c092D014D8Fc79712f566F5b96BDfa3Af53A5";
const RH_TRWI = "0x6F2C6F81DDd35199d2e015710c61CC6D8B5de9da";
const CELO_TRWI = "0xA1A10570534681606eF67Bc8DDeda6061Dd8a8f0";

export const RECORDED_CHAINS: RecordedChain[] = [
  {
    chainId: 421614, // Arbitrum Sepolia (limit of the public connection: 10,000,000 blocks)
    maxRange: 5_000_000,
    confirmations: 150,
    contracts: [
      token(ARB_TRWI, 3, 312199931),
      sale("0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030", ARB_TRWI, 3, 312199931), // first sale contract
      sale("0xf405669244d45E1C9d65C4af059921Dde76493F4", ARB_TRWI, 3, 316400740), // sale v2 (partner share)
      token(ARB_TRWI_V4, 4, 333368639), // revision 4, deployed 28.11.2026, not switched yet
      sale("0x7F992AAbE7D6EB69363711CdDeaf8895646A0C69", ARB_TRWI_V4, 4, 333368639),
    ],
    currencies: [
      coin(ZERO, "ETH", 18),
      coin("0xFFC95faa3d63Cde504a05B567C600B78C0b41892", "USDG", 6),
      coin("0x738B0C655E050320764EA1A7191BEA226B053410", "tUSDG", 6),
      coin("0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", "USDC", 6),
    ],
  },
  {
    chainId: 46630, // Robinhood Chain testnet (limit: 10,000,000 blocks)
    maxRange: 5_000_000,
    confirmations: 240,
    contracts: [
      token(RH_TRWI, 3, 123616235),
      sale("0x79E4bEAF41F415cE3DF55DaDe3F86423e5399030", RH_TRWI, 3, 123616235),
      sale("0x7E8bE9B2278EF55c3C05316035d0F9BA35757FCf", RH_TRWI, 3, 129934415),
    ],
    currencies: [coin(ZERO, "ETH", 18), coin("0x7E955252E15c84f5768B83c41a71F9eba181802F", "USDG", 6)],
  },
  {
    chainId: 11142220, // Celo Sepolia (limit: 100,000 blocks)
    maxRange: 90_000,
    confirmations: 40,
    contracts: [
      token(CELO_TRWI, 3, 27285071),
      sale("0x2b4A3aE4E69771cdf2Fd4e2075A7B3Ab2e0498B2", CELO_TRWI, 3, 27285071),
      sale("0x02f8F96aDFCBF07b4D028318eBD76bf8e4D24f76", CELO_TRWI, 3, 38014860),
    ],
    currencies: [
      coin(ZERO, "CELO", 18),
      coin("0x01C5C0122039549AD1493B8220cABEdD739BC44E", "USDC", 6),
      coin("0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b", "USDm", 18),
    ],
  },
];

export function recordedChain(chainId: number): RecordedChain | undefined {
  return RECORDED_CHAINS.find((c) => c.chainId === chainId);
}

/** Contract generation of a tRWI contract (3 or 4), or null when the record does not know the contract. */
export function tokenGeneration(chainId: number, tokenContract: string): 3 | 4 | null {
  const a = tokenContract.toLowerCase();
  return recordedChain(chainId)?.contracts.find((c) => c.role === "token" && c.address === a)?.generation ?? null;
}

export function recordedCurrency(chainId: number, address: string): RecordedCurrency | undefined {
  const a = address.toLowerCase();
  return recordedChain(chainId)?.currencies.find((c) => c.address === a);
}

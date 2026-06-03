// Postgres tables managed by Ponder. The web app reads these (read-only) for marketplace/leaderboard/holdings.
import { onchainTable } from "ponder";

export const impactToken = onchainTable("impact_token", (t) => ({
  id: t.bigint().primaryKey(), // tRWI token id
  creator: t.hex().notNull(),
  totalIV: t.bigint().notNull(),
  editions: t.bigint().notNull(),
  easUID: t.hex().notNull(),
  uri: t.text().notNull(),
  ivRetired: t.bigint().notNull().default(0n),
  createdAt: t.bigint().notNull(), // block timestamp
}));

export const stake = onchainTable("stake", (t) => ({
  id: t.bigint().primaryKey(), // stakeId
  owner: t.hex().notNull(),
  tokenId: t.bigint().notNull(),
  amount: t.bigint().notNull(),
  ivStaked: t.bigint().notNull(),
  lockEnd: t.bigint().notNull(),
  multiplierBps: t.integer().notNull(),
  rewardClaimed: t.bigint().notNull().default(0n),
  active: t.boolean().notNull().default(true),
}));

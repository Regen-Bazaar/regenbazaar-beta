// Postgres tables managed by Ponder (v2). The web app reads these (read-only) for marketplace/holdings.
import { onchainTable } from "ponder";

export const impactToken = onchainTable("impact_token", (t) => ({
  id: t.bigint().primaryKey(), // tRWI tokenId / collection
  creator: t.hex().notNull(), // NGO
  totalIV: t.bigint().notNull(),
  maxEditions: t.bigint().notNull(),
  minted: t.bigint().notNull().default(0n), // editions minted so far (lazy)
  retired: t.bigint().notNull().default(0n),
  easUID: t.hex().notNull(),
  uri: t.text().notNull(),
  createdAt: t.bigint().notNull(),
}));

export const sale = onchainTable("sale", (t) => ({
  id: t.text().primaryKey(), // `${tokenId}-${txHash}-${logIndex}`
  tokenId: t.bigint().notNull(),
  buyer: t.hex().notNull(),
  amount: t.bigint().notNull(),
  total: t.bigint().notNull(),
  currency: t.hex().notNull(),
  ts: t.bigint().notNull(),
}));

export const stake = onchainTable("stake", (t) => ({
  id: t.bigint().primaryKey(), // stakeId
  owner: t.hex().notNull(),
  tokenId: t.bigint().notNull(),
  amount: t.bigint().notNull(),
  ivStaked: t.bigint().notNull(),
  lockEnd: t.bigint().notNull(),
  multiplierBps: t.integer().notNull(),
  active: t.boolean().notNull().default(true),
}));

// Tables for contract revision 4. New Ponder schema per network (e.g. indexer_arbsep_r4); no staking tables.
import { onchainTable } from "ponder";

export const impactToken = onchainTable("impact_token", (t) => ({
  id: t.bigint().primaryKey(), // tokenId
  creator: t.hex().notNull(),
  totalIV: t.bigint().notNull(),
  maxEditions: t.bigint().notNull(),
  minted: t.bigint().notNull().default(0n),
  retired: t.bigint().notNull().default(0n),
  easUID: t.hex().notNull(),
  uri: t.text().notNull(),
  partner: t.hex(),
  validator: t.hex(),
  proofLevel: t.integer(),
  methodologyVersion: t.text(),
  transferable: t.boolean(),
  royaltyBps: t.integer(),
  resaleFeeBps: t.integer(),
  resalePartnerBps: t.integer(),
  withdrawn: t.boolean().notNull().default(false),
  createdAt: t.bigint().notNull(),
}));

// Withdrawn mark by attestation UID: an impact can be withdrawn before its first sale (no tokenId yet).
export const withdrawal = onchainTable("withdrawal", (t) => ({
  id: t.hex().primaryKey(), // easUID
  tokenId: t.bigint().notNull(), // 0 = not sold yet
  active: t.boolean().notNull(),
  reasonURI: t.text().notNull(),
  by: t.hex().notNull(),
  ts: t.bigint().notNull(),
}));

export const sale = onchainTable("sale", (t) => ({
  id: t.text().primaryKey(), // `${txHash}-${logIndex}`
  tokenId: t.bigint().notNull(),
  payer: t.hex().notNull(),
  recipient: t.hex().notNull(),
  amount: t.bigint().notNull(),
  currency: t.hex().notNull(),
  total: t.bigint().notNull(),
  creatorPaid: t.bigint().notNull(),
  platformPaid: t.bigint().notNull(),
  partnerPaid: t.bigint().notNull(),
  beneficiary: t.hex().notNull(),
  partner: t.hex().notNull(),
  ts: t.bigint().notNull(),
}));

export const resaleListing = onchainTable("resale_listing", (t) => ({
  id: t.bigint().primaryKey(), // listingId
  seller: t.hex().notNull(),
  tokenId: t.bigint().notNull(),
  remaining: t.bigint().notNull(),
  pricePerEdition: t.bigint().notNull(),
  currency: t.hex().notNull(),
  active: t.boolean().notNull(),
  createdAt: t.bigint().notNull(),
}));

export const resale = onchainTable("resale", (t) => ({
  id: t.text().primaryKey(), // `${txHash}-${logIndex}`
  listingId: t.bigint().notNull(),
  tokenId: t.bigint().notNull(),
  buyer: t.hex().notNull(),
  amount: t.bigint().notNull(),
  currency: t.hex().notNull(),
  total: t.bigint().notNull(),
  sellerPaid: t.bigint().notNull(),
  creatorPaid: t.bigint().notNull(),
  platformPaid: t.bigint().notNull(),
  partnerPaid: t.bigint().notNull(),
  ts: t.bigint().notNull(),
}));

// Contribution statements (retire), numbered on-chain.
export const statement = onchainTable("statement", (t) => ({
  id: t.bigint().primaryKey(), // statementId
  tokenId: t.bigint().notNull(),
  holder: t.hex().notNull(),
  amount: t.bigint().notNull(),
  impactValue: t.bigint().notNull(),
  inNameOf: t.text().notNull(),
  txHash: t.hex().notNull(),
  ts: t.bigint().notNull(),
}));

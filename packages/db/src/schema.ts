// Off-chain data model (Postgres / Drizzle). The CHAIN is the source of truth for ownership/sales/
// stakes (indexed separately); this DB holds off-chain app data + the impact pipeline: NGO profiles,
// submissions and their lifecycle (draft -> scored -> pending_verification -> verified -> tokenized),
// validator decisions, off->on-chain links (EAS attestation, tRWI tokenization), and the versioned
// action-weight reference tables that the deterministic IV engine reads.

import {
  pgTable,
  pgEnum,
  uuid,
  text,
  varchar,
  timestamp,
  numeric,
  integer,
  jsonb,
  boolean,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const impactDomain = pgEnum("impact_domain", [
  "environment",
  "animal_welfare",
  "education",
  "poverty",
  "social",
  "health",
]);

export const submissionStatus = pgEnum("submission_status", [
  "draft",
  "scored",
  "pending_verification",
  "verified",
  "rejected",
  "tokenized",
]);

export const userRole = pgEnum("user_role", ["buyer", "validator", "admin"]);
export const verificationDecision = pgEnum("verification_decision", ["approve", "reject", "request_info"]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull().unique(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  mission: text("mission"),
  country: varchar("country", { length: 2 }),
  region: text("region"),
  website: text("website"),
  verified: boolean("verified").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull().unique(),
  displayName: text("display_name"),
  role: userRole("role").notNull().default("buyer"),
  // Validator accounts (wallet sign-in). Removed accounts are marked, never deleted, so log lines keep their author.
  active: boolean("active").notNull().default(true),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  addedBy: uuid("added_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Server-side sessions: only the SHA-256 fingerprint of the cookie value is stored.
export const validatorSessions = pgTable(
  "validator_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("validator_sessions_user_idx").on(t.userId)],
);

// One-time sign-in numbers (valid 5 minutes, usable once).
export const authNonces = pgTable("auth_nonces", {
  nonce: varchar("nonce", { length: 64 }).primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  usedAt: timestamp("used_at", { withTimezone: true }),
});

// Append-only log of validator actions. The site has no route that updates or deletes a line.
export const actionLog = pgTable(
  "action_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    actorId: uuid("actor_id").references(() => users.id),
    actorWallet: varchar("actor_wallet", { length: 42 }), // copy at the moment of the action
    actorName: text("actor_name"), // copy at the moment of the action
    action: varchar("action", { length: 40 }).notNull(),
    objectType: varchar("object_type", { length: 20 }), // impact | listing | partner | validator
    objectId: text("object_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    note: text("note"),
    result: varchar("result", { length: 10 }).notNull().default("done"), // done | failed
    error: text("error"),
  },
  (t) => [index("action_log_created_idx").on(t.createdAt), index("action_log_actor_idx").on(t.actorId)],
);

export const impactSubmissions = pgTable(
  "impact_submissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id),
    title: text("title").notNull(),
    description: text("description").notNull(), // NGO free text
    domain: impactDomain("domain"),
    status: submissionStatus("status").notNull().default("draft"),
    extractedActions: jsonb("extracted_actions"), // ExtractedAction[]
    context: jsonb("context"), // ImpactContext (region/density/complexity/period)
    ivResult: jsonb("iv_result"), // full IVResult audit trail
    ivValue: numeric("iv_value", { precision: 30, scale: 4 }), // denormalized for sort/filter
    tablesVersion: varchar("tables_version", { length: 40 }),
    frameworkTags: jsonb("framework_tags"), // { sdg, ebf }
    mediaUris: jsonb("media_uris"), // string[]
    // Network chosen at submission; the report is listed on this chain only (null = legacy, pre-2026-09-25).
    chainId: integer("chain_id"),
    // Methodology v0.2 (null = scored before v0.2, i.e. v0.1; old rows are never rescored).
    methodologyVersion: varchar("methodology_version", { length: 10 }),
    location: jsonb("location"), // { lat, lon, ecosystem, layers } for ESM suggestions
    proofLinks: jsonb("proof_links"), // string[] of public https links given by the NGO
    proofChecks: jsonb("proof_checks"), // AI flags per link + snapshot hash; flags only, never a level
    proofLevel: varchar("proof_level", { length: 2 }), // P0..P4, set by a validator only
    domainScores: jsonb("domain_scores"), // DomainScoreV02[]
    registryDeclaration: jsonb("registry_declaration"), // { standard, serial? }
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("submission_org_idx").on(t.orgId), index("submission_status_idx").on(t.status)],
);

export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .notNull()
    .references(() => impactSubmissions.id),
  validatorId: uuid("validator_id").references(() => users.id),
  decision: verificationDecision("decision").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attestations = pgTable("attestations", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .notNull()
    .references(() => impactSubmissions.id),
  easUid: varchar("eas_uid", { length: 66 }).notNull().unique(),
  schemaUid: varchar("schema_uid", { length: 66 }),
  attester: varchar("attester", { length: 42 }),
  txHash: varchar("tx_hash", { length: 66 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tokenizations = pgTable("tokenizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .notNull()
    .references(() => impactSubmissions.id),
  easUid: varchar("eas_uid", { length: 66 }),
  tokenId: numeric("token_id", { precision: 78, scale: 0 }), // on-chain tRWI id (uint256)
  editions: integer("editions"),
  txHash: varchar("tx_hash", { length: 66 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Partner that brings impact to the platform (e.g. DeCleanup) and takes a share of each primary sale.
// The share is signed into the voucher (RegenPrimarySale v2); caps are enforced on-chain and in the voucher route.
export const partners = pgTable("partners", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 120 }).notNull(),
  payoutAddress: varchar("payout_address", { length: 42 }).notNull(),
  feeBps: integer("fee_bps").notNull(), // share of the primary sale price, basis points (<= 1000)
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Off-chain primary listing for a v2 "impact collection": registered at approve-time (no mint), an
// EIP-712 voucher is signed on demand from these fields, and the buyer lazily mints on redeem.
export const listings = pgTable("listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .notNull()
    .references(() => impactSubmissions.id),
  chainId: integer("chain_id").notNull().default(11142220), // network the listing is attested/sold on
  tokenId: numeric("token_id", { precision: 78, scale: 0 }).notNull(), // on-chain tRWI id (unique per chain)
  totalIvWei: numeric("total_iv_wei", { precision: 78, scale: 0 }).notNull(), // IV * 1e18
  maxEditions: integer("max_editions").notNull(),
  pricePerEdition: numeric("price_per_edition", { precision: 78, scale: 0 }).notNull(), // currency smallest unit
  currency: varchar("currency", { length: 42 }).notNull(), // 0x000..0 = native CELO
  beneficiary: varchar("beneficiary", { length: 42 }).notNull(), // NGO payout
  easUid: varchar("eas_uid", { length: 66 }).notNull(),
  metadataUri: text("metadata_uri").notNull(),
  priceUsd: numeric("price_usd", { precision: 30, scale: 4 }), // v0.2 total price in USD (null = v0.1 listing)
  priceModelVersion: varchar("price_model_version", { length: 40 }),
  partnerId: uuid("partner_id").references(() => partners.id), // null = no partner share
  nonce: integer("nonce").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  // Contract generation the listing was attested and is sold on: 3 = today's contracts, 4 = revision 4.
  contractGeneration: integer("contract_generation").notNull().default(3),
  // False claim withdrawn by an admin (revision 4): the listing is closed and shown as withdrawn.
  withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  withdrawnReason: text("withdrawn_reason"),
  // Edition limit (site rule): first sale seen by the site, and an admin's manual lift.
  firstSaleAt: timestamp("first_sale_at", { withTimezone: true }),
  editionLimitLiftedAt: timestamp("edition_limit_lifted_at", { withTimezone: true }),
  editionLimitLiftedBy: uuid("edition_limit_lifted_by").references(() => users.id),
}, (t) => [uniqueIndex("listings_chain_token_idx").on(t.chainId, t.tokenId)]);

// A validator's request to withdraw a false claim; only an admin decides. Rows are never deleted.
export const withdrawalRequests = pgTable(
  "withdrawal_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    listingId: uuid("listing_id")
      .notNull()
      .references(() => listings.id),
    requestedBy: uuid("requested_by").references(() => users.id), // null = shared access code
    requestedWallet: varchar("requested_wallet", { length: 42 }),
    reason: text("reason").notNull(),
    status: varchar("status", { length: 10 }).notNull().default("open"), // open | approved | rejected
    decidedBy: uuid("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    withdrawTx: varchar("withdraw_tx", { length: 66 }), // TRWIV4.withdraw
    revokeTx: varchar("revoke_tx", { length: 66 }), // EAS revoke
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("withdrawal_requests_listing_idx").on(t.listingId),
    // at most one open request per listing, even when two validators file at the same moment
    uniqueIndex("withdrawal_requests_one_open_idx").on(t.listingId).where(sql`status = 'open'`),
  ],
);

// DEPRECATED: not read by the engine (weights live in packages/impact-engine tables, versioned in code).
// Kept so existing databases need no destructive migration.
export const actionWeights = pgTable(
  "action_weights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    version: varchar("version", { length: 40 }).notNull(),
    actionType: varchar("action_type", { length: 60 }).notNull(),
    aw: numeric("aw", { precision: 12, scale: 4 }).notNull(),
    domain: impactDomain("domain").notNull(),
    unit: varchar("unit", { length: 30 }).notNull(),
    sdg: jsonb("sdg").notNull(), // string[]
    ebf: jsonb("ebf"), // string[] (environment only)
    active: boolean("active").notNull().default(true),
  },
  (t) => [uniqueIndex("aw_version_type_idx").on(t.version, t.actionType)],
);

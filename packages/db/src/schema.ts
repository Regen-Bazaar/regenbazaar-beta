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
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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

// Off-chain primary listing for a v2 "impact collection": registered at approve-time (no mint), an
// EIP-712 voucher is signed on demand from these fields, and the buyer lazily mints on redeem.
export const listings = pgTable("listings", {
  id: uuid("id").primaryKey().defaultRandom(),
  submissionId: uuid("submission_id")
    .notNull()
    .references(() => impactSubmissions.id),
  tokenId: numeric("token_id", { precision: 78, scale: 0 }).notNull().unique(), // on-chain tRWI id
  totalIvWei: numeric("total_iv_wei", { precision: 78, scale: 0 }).notNull(), // IV * 1e18
  maxEditions: integer("max_editions").notNull(),
  pricePerEdition: numeric("price_per_edition", { precision: 78, scale: 0 }).notNull(), // currency smallest unit
  currency: varchar("currency", { length: 42 }).notNull(), // 0x000..0 = native CELO
  beneficiary: varchar("beneficiary", { length: 42 }).notNull(), // NGO payout
  easUid: varchar("eas_uid", { length: 66 }).notNull(),
  metadataUri: text("metadata_uri").notNull(),
  nonce: integer("nonce").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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

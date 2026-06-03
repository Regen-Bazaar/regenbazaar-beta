// Schema snapshot applied to the in-process PGlite dev DB (no Docker). Mirrors
// packages/db/migrations/0000_*.sql — regenerate this string if the schema changes.
// `--> statement-breakpoint` lines are SQL comments and are ignored by PGlite.exec().

export const DEV_SCHEMA_SQL = `
DO $$ BEGIN CREATE TYPE "public"."impact_domain" AS ENUM('environment','animal_welfare','education','poverty','social','health'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."submission_status" AS ENUM('draft','scored','pending_verification','verified','rejected','tokenized'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."user_role" AS ENUM('buyer','validator','admin'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "public"."verification_decision" AS ENUM('approve','reject','request_info'); EXCEPTION WHEN duplicate_object THEN null; END $$;
CREATE TABLE IF NOT EXISTS "action_weights" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "version" varchar(40) NOT NULL,
  "action_type" varchar(60) NOT NULL,
  "aw" numeric(12, 4) NOT NULL,
  "domain" "impact_domain" NOT NULL,
  "unit" varchar(30) NOT NULL,
  "sdg" jsonb NOT NULL,
  "ebf" jsonb,
  "active" boolean DEFAULT true NOT NULL
);
CREATE TABLE IF NOT EXISTS "organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "name" text NOT NULL,
  "slug" varchar(80) NOT NULL,
  "mission" text,
  "country" varchar(2),
  "region" text,
  "website" text,
  "verified" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organizations_wallet_address_unique" UNIQUE("wallet_address"),
  CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "wallet_address" varchar(42) NOT NULL,
  "display_name" text,
  "role" "user_role" DEFAULT 'buyer' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address")
);
CREATE TABLE IF NOT EXISTS "impact_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "org_id" uuid NOT NULL REFERENCES "organizations"("id"),
  "title" text NOT NULL,
  "description" text NOT NULL,
  "domain" "impact_domain",
  "status" "submission_status" DEFAULT 'draft' NOT NULL,
  "extracted_actions" jsonb,
  "context" jsonb,
  "iv_result" jsonb,
  "iv_value" numeric(30, 4),
  "tables_version" varchar(40),
  "framework_tags" jsonb,
  "media_uris" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL REFERENCES "impact_submissions"("id"),
  "validator_id" uuid REFERENCES "users"("id"),
  "decision" "verification_decision" NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "attestations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL REFERENCES "impact_submissions"("id"),
  "eas_uid" varchar(66) NOT NULL,
  "schema_uid" varchar(66),
  "attester" varchar(42),
  "tx_hash" varchar(66),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "attestations_eas_uid_unique" UNIQUE("eas_uid")
);
CREATE TABLE IF NOT EXISTS "tokenizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL REFERENCES "impact_submissions"("id"),
  "eas_uid" varchar(66),
  "token_id" numeric(78, 0),
  "editions" integer,
  "tx_hash" varchar(66),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "aw_version_type_idx" ON "action_weights" USING btree ("version","action_type");
CREATE INDEX IF NOT EXISTS "submission_org_idx" ON "impact_submissions" USING btree ("org_id");
CREATE INDEX IF NOT EXISTS "submission_status_idx" ON "impact_submissions" USING btree ("status");
`;

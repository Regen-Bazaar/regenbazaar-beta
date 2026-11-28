// Schema snapshot applied to the in-process PGlite dev DB (no Docker). Mirrors
// packages/db/migrations/0000_*.sql. The `dev-schema-drift` test asserts this stays structurally
// identical to the migrations, so it cannot silently diverge. `--> statement-breakpoint` lines are
// SQL comments ignored by PGlite.exec(). CREATE TYPE is wrapped to be idempotent on a persistent dev DB.

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
  "active" boolean DEFAULT true NOT NULL,
  "removed_at" timestamp with time zone,
  "added_by" uuid,
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
  "chain_id" integer,
  "methodology_version" varchar(10),
  "location" jsonb,
  "proof_links" jsonb,
  "proof_checks" jsonb,
  "proof_level" varchar(2),
  "domain_scores" jsonb,
  "registry_declaration" jsonb,
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
CREATE TABLE IF NOT EXISTS "partners" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(120) NOT NULL,
  "payout_address" varchar(42) NOT NULL,
  "fee_bps" integer NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "listings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL REFERENCES "impact_submissions"("id"),
  "chain_id" integer DEFAULT 11142220 NOT NULL,
  "token_id" numeric(78, 0) NOT NULL,
  "total_iv_wei" numeric(78, 0) NOT NULL,
  "max_editions" integer NOT NULL,
  "price_per_edition" numeric(78, 0) NOT NULL,
  "currency" varchar(42) NOT NULL,
  "beneficiary" varchar(42) NOT NULL,
  "eas_uid" varchar(66) NOT NULL,
  "metadata_uri" text NOT NULL,
  "price_usd" numeric(30, 4),
  "price_model_version" varchar(40),
  "partner_id" uuid REFERENCES "partners"("id"),
  "nonce" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "listings_chain_token_idx" ON "listings" USING btree ("chain_id","token_id");
CREATE UNIQUE INDEX IF NOT EXISTS "aw_version_type_idx" ON "action_weights" USING btree ("version","action_type");
CREATE INDEX IF NOT EXISTS "submission_org_idx" ON "impact_submissions" USING btree ("org_id");
CREATE INDEX IF NOT EXISTS "submission_status_idx" ON "impact_submissions" USING btree ("status");
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "active" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "removed_at" timestamp with time zone;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "added_by" uuid;
CREATE TABLE IF NOT EXISTS "validator_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "token_hash" varchar(64) NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "revoked_at" timestamp with time zone,
  CONSTRAINT "validator_sessions_token_hash_unique" UNIQUE("token_hash")
);
CREATE INDEX IF NOT EXISTS "validator_sessions_user_idx" ON "validator_sessions" ("user_id");
CREATE TABLE IF NOT EXISTS "auth_nonces" (
  "nonce" varchar(64) PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "used_at" timestamp with time zone
);
CREATE TABLE IF NOT EXISTS "action_log" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "actor_id" uuid REFERENCES "users"("id"),
  "actor_wallet" varchar(42),
  "actor_name" text,
  "action" varchar(40) NOT NULL,
  "object_type" varchar(20),
  "object_id" text,
  "before" jsonb,
  "after" jsonb,
  "note" text,
  "result" varchar(10) DEFAULT 'done' NOT NULL,
  "error" text
);
CREATE INDEX IF NOT EXISTS "action_log_created_idx" ON "action_log" ("created_at");
CREATE INDEX IF NOT EXISTS "action_log_actor_idx" ON "action_log" ("actor_id");
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "contract_generation" integer DEFAULT 3 NOT NULL;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "withdrawn_at" timestamp with time zone;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "withdrawn_reason" text;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "first_sale_at" timestamp with time zone;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "edition_limit_lifted_at" timestamp with time zone;
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "edition_limit_lifted_by" uuid REFERENCES "users"("id");
CREATE TABLE IF NOT EXISTS "withdrawal_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "listing_id" uuid NOT NULL REFERENCES "listings"("id"),
  "requested_by" uuid REFERENCES "users"("id"),
  "requested_wallet" varchar(42),
  "reason" text NOT NULL,
  "status" varchar(10) DEFAULT 'open' NOT NULL,
  "decided_by" uuid REFERENCES "users"("id"),
  "decided_at" timestamp with time zone,
  "decision_note" text,
  "withdraw_tx" varchar(66),
  "revoke_tx" varchar(66),
  "claim_token" uuid,
  "claimed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "withdrawal_requests_listing_idx" ON "withdrawal_requests" ("listing_id");
CREATE UNIQUE INDEX IF NOT EXISTS "withdrawal_requests_one_open_idx" ON "withdrawal_requests" ("listing_id") WHERE status in ('open', 'approving');
CREATE TABLE IF NOT EXISTS "ai_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "submission_id" uuid REFERENCES "impact_submissions"("id"),
  "job" varchar(30) NOT NULL,
  "provider" varchar(20) NOT NULL,
  "model" varchar(120) NOT NULL,
  "instruction_version" varchar(30) NOT NULL,
  "input_tokens" integer,
  "output_tokens" integer,
  "duration_ms" integer NOT NULL,
  "ok" boolean NOT NULL,
  "error" text,
  "output" jsonb
);
CREATE INDEX IF NOT EXISTS "ai_runs_submission_idx" ON "ai_runs" ("submission_id");
CREATE INDEX IF NOT EXISTS "ai_runs_created_idx" ON "ai_runs" ("created_at");
CREATE TABLE IF NOT EXISTS "proof_pages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL REFERENCES "impact_submissions"("id"),
  "kind" varchar(10) NOT NULL,
  "url" text NOT NULL,
  "final_url" text,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "http_status" integer,
  "content_type" varchar(100),
  "sha256" varchar(64),
  "bytes" integer,
  "truncated" boolean DEFAULT false NOT NULL,
  "page_text" text,
  "facts" jsonb,
  "reader" varchar(10) DEFAULT 'none' NOT NULL,
  "error" text
);
CREATE UNIQUE INDEX IF NOT EXISTS "proof_pages_submission_url_idx" ON "proof_pages" ("submission_id", "url");
CREATE TABLE IF NOT EXISTS "review_state" (
  "submission_id" uuid PRIMARY KEY NOT NULL REFERENCES "impact_submissions"("id"),
  "state" varchar(20) DEFAULT 'waiting' NOT NULL,
  "opened_by" uuid REFERENCES "users"("id"),
  "opened_by_name" text,
  "opened_at" timestamp with time zone,
  "place_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "proof_status" varchar(10) DEFAULT 'none' NOT NULL,
  "proof_started_at" timestamp with time zone,
  "proof_finished_at" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE TABLE IF NOT EXISTS "review_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "submission_id" uuid NOT NULL REFERENCES "impact_submissions"("id"),
  "author_id" uuid REFERENCES "users"("id"),
  "author_name" text,
  "author_wallet" varchar(42),
  "body" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "review_notes_submission_idx" ON "review_notes" ("submission_id");
`;

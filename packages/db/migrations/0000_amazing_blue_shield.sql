CREATE TYPE "public"."impact_domain" AS ENUM('environment', 'animal_welfare', 'education', 'poverty', 'social', 'health');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('draft', 'scored', 'pending_verification', 'verified', 'rejected', 'tokenized');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('buyer', 'validator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."verification_decision" AS ENUM('approve', 'reject', 'request_info');--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "attestations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"eas_uid" varchar(66) NOT NULL,
	"schema_uid" varchar(66),
	"attester" varchar(42),
	"tx_hash" varchar(66),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attestations_eas_uid_unique" UNIQUE("eas_uid")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "impact_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tokenizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"eas_uid" varchar(66),
	"token_id" numeric(78, 0),
	"editions" integer,
	"tx_hash" varchar(66),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" varchar(42) NOT NULL,
	"display_name" text,
	"role" "user_role" DEFAULT 'buyer' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"validator_id" uuid,
	"decision" "verification_decision" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "attestations" ADD CONSTRAINT "attestations_submission_id_impact_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."impact_submissions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "impact_submissions" ADD CONSTRAINT "impact_submissions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tokenizations" ADD CONSTRAINT "tokenizations_submission_id_impact_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."impact_submissions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verifications" ADD CONSTRAINT "verifications_submission_id_impact_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."impact_submissions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "verifications" ADD CONSTRAINT "verifications_validator_id_users_id_fk" FOREIGN KEY ("validator_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "aw_version_type_idx" ON "action_weights" USING btree ("version","action_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submission_org_idx" ON "impact_submissions" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "submission_status_idx" ON "impact_submissions" USING btree ("status");
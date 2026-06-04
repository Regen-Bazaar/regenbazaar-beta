CREATE TABLE "listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"token_id" numeric(78, 0) NOT NULL,
	"total_iv_wei" numeric(78, 0) NOT NULL,
	"max_editions" integer NOT NULL,
	"price_per_edition" numeric(78, 0) NOT NULL,
	"currency" varchar(42) NOT NULL,
	"beneficiary" varchar(42) NOT NULL,
	"eas_uid" varchar(66) NOT NULL,
	"metadata_uri" text NOT NULL,
	"nonce" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listings_token_id_unique" UNIQUE("token_id")
);
--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_submission_id_impact_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."impact_submissions"("id") ON DELETE no action ON UPDATE no action;
CREATE TABLE "withdrawal_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"requested_by" uuid,
	"requested_wallet" varchar(42),
	"reason" text NOT NULL,
	"status" varchar(10) DEFAULT 'open' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"withdraw_tx" varchar(66),
	"revoke_tx" varchar(66),
	"claim_token" uuid,
	"claimed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "contract_generation" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "withdrawn_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "withdrawn_reason" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "first_sale_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "edition_limit_lifted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "edition_limit_lifted_by" uuid;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "withdrawal_requests_listing_idx" ON "withdrawal_requests" USING btree ("listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "withdrawal_requests_one_open_idx" ON "withdrawal_requests" USING btree ("listing_id") WHERE status in ('open', 'approving');--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_edition_limit_lifted_by_users_id_fk" FOREIGN KEY ("edition_limit_lifted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
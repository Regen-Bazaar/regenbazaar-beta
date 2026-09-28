ALTER TABLE "impact_submissions" ADD COLUMN "methodology_version" varchar(10);--> statement-breakpoint
ALTER TABLE "impact_submissions" ADD COLUMN "location" jsonb;--> statement-breakpoint
ALTER TABLE "impact_submissions" ADD COLUMN "proof_links" jsonb;--> statement-breakpoint
ALTER TABLE "impact_submissions" ADD COLUMN "proof_checks" jsonb;--> statement-breakpoint
ALTER TABLE "impact_submissions" ADD COLUMN "proof_level" varchar(2);--> statement-breakpoint
ALTER TABLE "impact_submissions" ADD COLUMN "domain_scores" jsonb;--> statement-breakpoint
ALTER TABLE "impact_submissions" ADD COLUMN "registry_declaration" jsonb;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "price_usd" numeric(30, 4);--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "price_model_version" varchar(40);
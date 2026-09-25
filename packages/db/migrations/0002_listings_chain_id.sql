ALTER TABLE "listings" DROP CONSTRAINT "listings_token_id_unique";--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "chain_id" integer DEFAULT 11142220 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "listings_chain_token_idx" ON "listings" USING btree ("chain_id","token_id");
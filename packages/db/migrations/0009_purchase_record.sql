CREATE TABLE "edition_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chain_id" integer NOT NULL,
	"contract" varchar(42) NOT NULL,
	"token_contract" varchar(42) NOT NULL,
	"kind" varchar(12) NOT NULL,
	"token_id" numeric(78, 0) NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"wallet" varchar(42),
	"from_address" varchar(42),
	"to_address" varchar(42),
	"payer" varchar(42),
	"currency" varchar(42),
	"total_paid" numeric(78, 0),
	"statement_id" numeric(78, 0),
	"in_name_of" text,
	"block_number" bigint NOT NULL,
	"block_time" timestamp with time zone NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"log_index" integer NOT NULL,
	"batch_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"chain_id" integer NOT NULL,
	"token_contract" varchar(42) NOT NULL,
	"token_id" numeric(78, 0) NOT NULL,
	"wallet" varchar(42) NOT NULL,
	"editions_held" numeric(78, 0) DEFAULT '0' NOT NULL,
	"editions_retired" numeric(78, 0) DEFAULT '0' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holdings_chain_id_token_contract_token_id_wallet_pk" PRIMARY KEY("chain_id","token_contract","token_id","wallet")
);
--> statement-breakpoint
CREATE TABLE "record_cursors" (
	"chain_id" integer NOT NULL,
	"contract" varchar(42) NOT NULL,
	"last_block" bigint NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "record_cursors_chain_id_contract_pk" PRIMARY KEY("chain_id","contract")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "edition_events_log_idx" ON "edition_events" USING btree ("chain_id","tx_hash","log_index","batch_index");--> statement-breakpoint
CREATE INDEX "edition_events_wallet_idx" ON "edition_events" USING btree ("wallet");--> statement-breakpoint
CREATE INDEX "edition_events_token_idx" ON "edition_events" USING btree ("chain_id","token_contract","token_id");--> statement-breakpoint
CREATE INDEX "holdings_wallet_idx" ON "holdings" USING btree ("wallet");
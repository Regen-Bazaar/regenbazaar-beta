CREATE TABLE "action_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_id" uuid,
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
--> statement-breakpoint
CREATE TABLE "auth_nonces" (
	"nonce" varchar(64) PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "validator_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "validator_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "removed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "added_by" uuid;--> statement-breakpoint
ALTER TABLE "action_log" ADD CONSTRAINT "action_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validator_sessions" ADD CONSTRAINT "validator_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "action_log_created_idx" ON "action_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "action_log_actor_idx" ON "action_log" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "validator_sessions_user_idx" ON "validator_sessions" USING btree ("user_id");
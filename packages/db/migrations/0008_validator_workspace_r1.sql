CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"submission_id" uuid,
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
--> statement-breakpoint
CREATE TABLE "proof_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
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
--> statement-breakpoint
CREATE TABLE "review_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submission_id" uuid NOT NULL,
	"author_id" uuid,
	"author_name" text,
	"author_wallet" varchar(42),
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_state" (
	"submission_id" uuid PRIMARY KEY NOT NULL,
	"state" varchar(20) DEFAULT 'waiting' NOT NULL,
	"opened_by" uuid,
	"opened_by_name" text,
	"opened_at" timestamp with time zone,
	"place_names" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"proof_status" varchar(10) DEFAULT 'none' NOT NULL,
	"proof_started_at" timestamp with time zone,
	"proof_finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_submission_id_impact_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."impact_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_pages" ADD CONSTRAINT "proof_pages_submission_id_impact_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."impact_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_notes" ADD CONSTRAINT "review_notes_submission_id_impact_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."impact_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_notes" ADD CONSTRAINT "review_notes_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_state" ADD CONSTRAINT "review_state_submission_id_impact_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."impact_submissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_state" ADD CONSTRAINT "review_state_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_runs_submission_idx" ON "ai_runs" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "ai_runs_created_idx" ON "ai_runs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "proof_pages_submission_url_idx" ON "proof_pages" USING btree ("submission_id","url");--> statement-breakpoint
CREATE INDEX "review_notes_submission_idx" ON "review_notes" USING btree ("submission_id");
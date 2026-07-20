CREATE TABLE "evaluation_job_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid NOT NULL,
	"evaluation_job_uuid" uuid NOT NULL,
	"item_seq_no" integer DEFAULT 0 NOT NULL,
	"item_status" text DEFAULT 'pending' NOT NULL,
	"record_uuid" text DEFAULT '' NOT NULL,
	"error_message" text DEFAULT '' NOT NULL,
	CONSTRAINT "evaluation_job_item_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "evaluation_job" (
	"uuid" uuid PRIMARY KEY NOT NULL,
	"institute_name" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"error_message" text DEFAULT '' NOT NULL,
	"record_uuid" text DEFAULT '' NOT NULL,
	"cancel_requested" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_evaluation_job_item_job" ON "evaluation_job_item" USING btree ("evaluation_job_uuid");--> statement-breakpoint
CREATE INDEX "idx_evaluation_job_institute" ON "evaluation_job" USING btree ("institute_name");
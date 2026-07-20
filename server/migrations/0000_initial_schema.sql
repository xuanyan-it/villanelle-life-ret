CREATE TABLE "institute" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid NOT NULL,
	"institute_name" text NOT NULL,
	"token" text NOT NULL,
	"created_at" text DEFAULT '' NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "institute_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "record" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid NOT NULL,
	"hospital_name" text DEFAULT '' NOT NULL,
	"doctor_name" text DEFAULT '' NOT NULL,
	"patient_name" text DEFAULT '' NOT NULL,
	"patient_age" text DEFAULT '' NOT NULL,
	"patient_gender" text DEFAULT '' NOT NULL,
	"sample_id" text DEFAULT '' NOT NULL,
	"sample_type" text DEFAULT '' NOT NULL,
	"sampling_date" text DEFAULT '' NOT NULL,
	"reception_date" text DEFAULT '' NOT NULL,
	"test_date" text DEFAULT '' NOT NULL,
	"rps4y1" text DEFAULT '' NOT NULL,
	"pkhd1l1" text DEFAULT '' NOT NULL,
	"crabp1" text DEFAULT '' NOT NULL,
	"gapdh" text DEFAULT '' NOT NULL,
	"tester_name" text DEFAULT '' NOT NULL,
	"checker_name" text DEFAULT '' NOT NULL,
	"reviewer_name" text DEFAULT '' NOT NULL,
	"other_info" text DEFAULT '' NOT NULL,
	"result" text DEFAULT '' NOT NULL,
	"institute_name" text DEFAULT '' NOT NULL,
	"is_deleted" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "record_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" serial PRIMARY KEY NOT NULL,
	"uuid" uuid NOT NULL,
	"institute_name" text DEFAULT '' NOT NULL,
	"user_role" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"username" text DEFAULT '' NOT NULL,
	"pass_hash" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_activated" boolean DEFAULT true NOT NULL,
	CONSTRAINT "user_uuid_unique" UNIQUE("uuid")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "institute_institute_name_unique" ON "institute" USING btree ("institute_name");--> statement-breakpoint
CREATE UNIQUE INDEX "institute_token_unique" ON "institute" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_record_institute_deleted" ON "record" USING btree ("institute_name","is_deleted");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_unique" ON "user" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "user_username_unique" ON "user" USING btree ("username");
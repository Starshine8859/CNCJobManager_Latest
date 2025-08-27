CREATE TABLE "job_hardware" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"hardware_name" text NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"on_hand_qty" integer DEFAULT 0 NOT NULL,
	"needed" integer DEFAULT 0 NOT NULL,
	"used" integer DEFAULT 0 NOT NULL,
	"still_required" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_rods" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"rod_name" text NOT NULL,
	"length_inches" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_sheets" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" integer NOT NULL,
	"material_type" text NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_hardware" ADD CONSTRAINT "job_hardware_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_rods" ADD CONSTRAINT "job_rods_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_sheets" ADD CONSTRAINT "job_sheets_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;
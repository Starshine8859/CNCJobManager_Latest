ALTER TABLE "job_hardware" DROP CONSTRAINT "job_hardware_supply_id_supplies_id_fk";
--> statement-breakpoint
ALTER TABLE "job_hardware" DROP CONSTRAINT "job_hardware_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "job_rods" DROP CONSTRAINT "job_rods_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "job_sheets" DROP CONSTRAINT "job_sheets_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "part_checklists" DROP CONSTRAINT "part_checklists_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "job_rods" ALTER COLUMN "length_inches" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "job_rods" ALTER COLUMN "length_inches" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "job_sheets" ALTER COLUMN "qty" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "part_checklists" ALTER COLUMN "job_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "part_checklists" ALTER COLUMN "is_template" SET DEFAULT true;--> statement-breakpoint
ALTER TABLE "job_hardware" ADD COLUMN "hardware_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "job_hardware" ADD COLUMN "qty" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_hardware" ADD COLUMN "on_hand_qty" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_hardware" ADD COLUMN "needed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_hardware" ADD CONSTRAINT "job_hardware_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_rods" ADD CONSTRAINT "job_rods_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_sheets" ADD CONSTRAINT "job_sheets_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_checklists" ADD CONSTRAINT "part_checklists_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_hardware" DROP COLUMN "supply_id";--> statement-breakpoint
ALTER TABLE "job_hardware" DROP COLUMN "allocated";--> statement-breakpoint
ALTER TABLE "part_checklists" DROP COLUMN "completed";
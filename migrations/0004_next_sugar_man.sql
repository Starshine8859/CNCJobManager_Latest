ALTER TABLE "job_hardware" DROP CONSTRAINT "job_hardware_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "job_rods" DROP CONSTRAINT "job_rods_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "job_sheets" DROP CONSTRAINT "job_sheets_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "part_checklist_items" DROP CONSTRAINT "part_checklist_items_completed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "part_checklists" DROP CONSTRAINT "part_checklists_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "job_rods" ALTER COLUMN "length_inches" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "job_sheets" ALTER COLUMN "qty" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "job_hardware" ADD COLUMN "on_hand" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_hardware" ADD COLUMN "available" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "part_checklist_items" ADD COLUMN "part_name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "part_checklist_items" ADD COLUMN "qty" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "part_checklist_items" ADD COLUMN "is_checked" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "job_hardware" ADD CONSTRAINT "job_hardware_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_rods" ADD CONSTRAINT "job_rods_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_sheets" ADD CONSTRAINT "job_sheets_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_checklists" ADD CONSTRAINT "part_checklists_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_checklist_items" DROP COLUMN "name";--> statement-breakpoint
ALTER TABLE "part_checklist_items" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "part_checklist_items" DROP COLUMN "category";--> statement-breakpoint
ALTER TABLE "part_checklist_items" DROP COLUMN "sort_order";--> statement-breakpoint
ALTER TABLE "part_checklist_items" DROP COLUMN "is_completed";--> statement-breakpoint
ALTER TABLE "part_checklist_items" DROP COLUMN "completed_at";--> statement-breakpoint
ALTER TABLE "part_checklist_items" DROP COLUMN "completed_by";--> statement-breakpoint
ALTER TABLE "part_checklists" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "part_checklists" DROP COLUMN "is_template";--> statement-breakpoint
ALTER TABLE "part_checklists" DROP COLUMN "completed";
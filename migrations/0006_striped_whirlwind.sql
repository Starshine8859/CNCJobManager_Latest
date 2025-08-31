ALTER TABLE "part_checklists" DROP CONSTRAINT "part_checklists_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "part_checklists" ALTER COLUMN "job_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "part_checklists" ADD COLUMN "completed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "part_checklists" ADD CONSTRAINT "part_checklists_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_checklists" DROP COLUMN "description";--> statement-breakpoint
ALTER TABLE "part_checklists" DROP COLUMN "is_template";
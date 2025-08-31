DROP INDEX "job_hardware_job_id_idx";--> statement-breakpoint
DROP INDEX "job_rods_job_id_idx";--> statement-breakpoint
DROP INDEX "job_sheets_job_id_idx";--> statement-breakpoint
ALTER TABLE "job_sheets" ALTER COLUMN "qty" SET DEFAULT 0;
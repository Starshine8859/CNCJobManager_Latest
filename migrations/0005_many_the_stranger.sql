ALTER TABLE "job_hardware" ALTER COLUMN "allocated" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "job_hardware" ALTER COLUMN "used" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "job_hardware" ALTER COLUMN "still_required" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "job_rods" ALTER COLUMN "length_inches" SET DEFAULT 0;
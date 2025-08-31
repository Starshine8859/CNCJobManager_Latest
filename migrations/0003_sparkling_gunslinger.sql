ALTER TABLE "job_hardware" DROP CONSTRAINT "job_hardware_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "job_rods" DROP CONSTRAINT "job_rods_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "job_sheets" DROP CONSTRAINT "job_sheets_job_id_jobs_id_fk";
--> statement-breakpoint
ALTER TABLE "job_hardware" ALTER COLUMN "used" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "job_hardware" ALTER COLUMN "still_required" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "job_rods" ALTER COLUMN "length_inches" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "job_sheets" ALTER COLUMN "qty" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "job_hardware" ADD COLUMN "supply_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "job_hardware" ADD COLUMN "allocated" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "job_hardware" ADD CONSTRAINT "job_hardware_supply_id_supplies_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."supplies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_hardware" ADD CONSTRAINT "job_hardware_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_rods" ADD CONSTRAINT "job_rods_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_sheets" ADD CONSTRAINT "job_sheets_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_hardware_job_id_idx" ON "job_hardware" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_rods_job_id_idx" ON "job_rods" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "job_sheets_job_id_idx" ON "job_sheets" USING btree ("job_id");--> statement-breakpoint
ALTER TABLE "job_hardware" DROP COLUMN "hardware_name";--> statement-breakpoint
ALTER TABLE "job_hardware" DROP COLUMN "qty";--> statement-breakpoint
ALTER TABLE "job_hardware" DROP COLUMN "on_hand_qty";--> statement-breakpoint
ALTER TABLE "job_hardware" DROP COLUMN "needed";
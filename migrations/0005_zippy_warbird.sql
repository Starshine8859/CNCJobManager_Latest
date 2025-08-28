ALTER TABLE "job_rods" ADD COLUMN "supply_id" integer;--> statement-breakpoint
ALTER TABLE "job_rods" ADD COLUMN "allocated" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "job_rods" ADD COLUMN "used" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "job_rods" ADD COLUMN "still_required" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "job_rods" ADD CONSTRAINT "job_rods_supply_id_supplies_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."supplies"("id") ON DELETE no action ON UPDATE no action;
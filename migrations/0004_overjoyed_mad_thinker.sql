ALTER TABLE "job_hardware" ADD COLUMN "supply_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "job_hardware" ADD COLUMN "on_hand" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_hardware" ADD COLUMN "available" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_hardware" ADD COLUMN "allocated" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "job_hardware" ADD CONSTRAINT "job_hardware_supply_id_supplies_id_fk" FOREIGN KEY ("supply_id") REFERENCES "public"."supplies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_hardware" DROP COLUMN "hardware_name";--> statement-breakpoint
ALTER TABLE "job_hardware" DROP COLUMN "on_hand_qty";--> statement-breakpoint
ALTER TABLE "job_hardware" DROP COLUMN "needed";
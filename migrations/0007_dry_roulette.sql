ALTER TABLE "part_checklists" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "part_checklists" ADD COLUMN "is_template" boolean DEFAULT false;
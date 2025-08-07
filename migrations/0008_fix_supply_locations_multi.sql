-- Migration: Allow multiple locations per supply in supply_locations

-- Drop unique constraint on supply_id if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'supply_locations' 
      AND constraint_type = 'UNIQUE' 
      AND constraint_name = 'supply_locations_supply_id_key'
  ) THEN
    EXECUTE 'ALTER TABLE supply_locations DROP CONSTRAINT supply_locations_supply_id_key';
  END IF;
END $$;

-- Add unique constraint on (supply_id, location_id) if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'supply_locations' 
      AND constraint_type = 'UNIQUE' 
      AND constraint_name = 'supply_locations_supply_id_location_id_key'
  ) THEN
    EXECUTE 'ALTER TABLE supply_locations ADD CONSTRAINT supply_locations_supply_id_location_id_key UNIQUE (supply_id, location_id)';
  END IF;
END $$;
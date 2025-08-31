-- Migration: Update supplies table to use defaultVendor as text instead of defaultVendorId as foreign key
-- This migration changes the vendor field from a foreign key reference to a simple text field

-- 1. Add the new defaultVendor column
ALTER TABLE supplies 
ADD COLUMN IF NOT EXISTS default_vendor TEXT;

-- 2. Drop the foreign key constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'supplies_default_vendor_id_fkey' 
        AND table_name = 'supplies'
    ) THEN
        ALTER TABLE supplies DROP CONSTRAINT supplies_default_vendor_id_fkey;
    END IF;
END $$;

-- 3. Drop the old defaultVendorId column
ALTER TABLE supplies 
DROP COLUMN IF EXISTS default_vendor_id;

-- 4. Create index on the new column for performance
CREATE INDEX IF NOT EXISTS idx_supplies_default_vendor ON supplies(default_vendor);

-- 5. Update any existing records to have empty string instead of null
UPDATE supplies 
SET default_vendor = '' 
WHERE default_vendor IS NULL; 
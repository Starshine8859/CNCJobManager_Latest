-- Migration: Create vendors system and add vendor fields to supplies
-- This migration creates the vendors table and adds vendor management to supplies

-- 1. Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact_info TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 2. Add vendor fields to supplies table
ALTER TABLE supplies 
ADD COLUMN IF NOT EXISTS default_vendor_id INTEGER REFERENCES vendors(id),
ADD COLUMN IF NOT EXISTS default_vendor_price INTEGER;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_supplies_default_vendor_id ON supplies(default_vendor_id);
CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);

-- 4. Add trigger to update updated_at timestamp for vendors
CREATE TRIGGER update_vendors_updated_at 
    BEFORE UPDATE ON vendors 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 5. Insert some default vendors for testing
INSERT INTO vendors (name, contact_info, address, phone, email) VALUES
  ('Retail Supplier', 'General retail supplier', '123 Retail St, City, State', '555-0100', 'retail@example.com'),
  ('Wholesale Materials Co', 'Wholesale materials supplier', '456 Wholesale Ave, City, State', '555-0200', 'wholesale@example.com'),
  ('Premium Supplies Inc', 'Premium quality materials', '789 Premium Blvd, City, State', '555-0300', 'premium@example.com')
ON CONFLICT (name) DO NOTHING; 
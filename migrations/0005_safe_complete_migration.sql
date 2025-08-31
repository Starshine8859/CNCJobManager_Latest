-- Safe Complete Database Migration: From Old Structure to New Structure
-- This migration updates the database to support the new inventory and purchase order system
-- It handles missing columns gracefully

-- 1. Create vendors table if it doesn't exist
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

-- 2. Create locations table if it doesn't exist (replaces color_groups)
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 3. Create supplies table if it doesn't exist (replaces colors)
CREATE TABLE IF NOT EXISTS supplies (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  hex_color TEXT NOT NULL,
  piece_size TEXT NOT NULL DEFAULT 'sheet',
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  needed INTEGER NOT NULL DEFAULT 0,
  available INTEGER NOT NULL DEFAULT 0,
  allocated INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0,
  location_id INTEGER REFERENCES locations(id),
  vendor_id INTEGER REFERENCES vendors(id),
  default_vendor TEXT,
  default_vendor_price INTEGER,
  texture TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 4. Create supply_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS supply_transactions (
  id SERIAL PRIMARY KEY,
  supply_id INTEGER NOT NULL REFERENCES supplies(id),
  type TEXT NOT NULL, -- 'receive', 'use', 'adjust', 'allocate'
  quantity INTEGER NOT NULL,
  description TEXT,
  job_id INTEGER,
  user_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 5. Create purchase_orders table if it doesn't exist
CREATE TABLE IF NOT EXISTS purchase_orders (
  id SERIAL PRIMARY KEY,
  po_number TEXT NOT NULL UNIQUE,
  date_ordered TIMESTAMP,
  date_received TIMESTAMP,
  total_amount INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'ordered', 'received'
  additional_comments TEXT,
  created_by INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 6. Create purchase_order_items table if it doesn't exist
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id),
  supply_id INTEGER NOT NULL REFERENCES supplies(id),
  vendor_id INTEGER REFERENCES vendors(id),
  quantity INTEGER NOT NULL,
  price_per_unit INTEGER NOT NULL,
  total_price INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 7. Create sheet_cut_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS sheet_cut_logs (
  id SERIAL PRIMARY KEY,
  material_id INTEGER NOT NULL,
  sheet_index INTEGER NOT NULL,
  status TEXT NOT NULL,
  is_recut BOOLEAN NOT NULL DEFAULT FALSE,
  recut_id INTEGER,
  user_id INTEGER,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 8. Safely migrate data from old color_groups to locations
DO $$
BEGIN
  -- Check if color_groups table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'color_groups') THEN
    -- Check if updated_at column exists in color_groups
    IF EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'color_groups' AND column_name = 'updated_at'
    ) THEN
      INSERT INTO locations (name, created_at, updated_at)
      SELECT name, created_at, updated_at FROM color_groups
      ON CONFLICT (name) DO NOTHING;
    ELSE
      -- If updated_at doesn't exist, use created_at for both
      INSERT INTO locations (name, created_at, updated_at)
      SELECT 
        name, 
        COALESCE(created_at, NOW()) as created_at, 
        COALESCE(created_at, NOW()) as updated_at 
      FROM color_groups
      ON CONFLICT (name) DO NOTHING;
    END IF;
  END IF;
END $$;

-- 9. Safely migrate data from old colors to supplies
DO $$
BEGIN
  -- Check if colors table exists
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'colors') THEN
    -- Check if updated_at column exists in colors
    IF EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_name = 'colors' AND column_name = 'updated_at'
    ) THEN
      INSERT INTO supplies (
        name, 
        hex_color, 
        piece_size, 
        quantity_on_hand, 
        location_id,
        created_at, 
        updated_at
      )
      SELECT 
        c.name,
        c.hex_color,
        'sheet' as piece_size,
        0 as quantity_on_hand,
        l.id as location_id,
        c.created_at,
        c.updated_at
      FROM colors c
      LEFT JOIN locations l ON l.name = (
        SELECT cg.name FROM color_groups cg WHERE cg.id = c.group_id
      )
      ON CONFLICT (name) DO NOTHING;
    ELSE
      -- If updated_at doesn't exist, use created_at for both
      INSERT INTO supplies (
        name, 
        hex_color, 
        piece_size, 
        quantity_on_hand, 
        location_id,
        created_at, 
        updated_at
      )
      SELECT 
        c.name,
        c.hex_color,
        'sheet' as piece_size,
        0 as quantity_on_hand,
        l.id as location_id,
        COALESCE(c.created_at, NOW()) as created_at,
        COALESCE(c.created_at, NOW()) as updated_at
      FROM colors c
      LEFT JOIN locations l ON l.name = (
        SELECT cg.name FROM color_groups cg WHERE cg.id = c.group_id
      )
      ON CONFLICT (name) DO NOTHING;
    END IF;
  END IF;
END $$;

-- 10. Insert default vendors
INSERT INTO vendors (name, contact_info, address, phone, email) VALUES
  ('Retail Supplier', 'General retail supplier', '123 Retail St, City, State', '555-0100', 'retail@example.com'),
  ('Wholesale Materials Co', 'Wholesale materials supplier', '456 Wholesale Ave, City, State', '555-0200', 'wholesale@example.com'),
  ('Premium Supplies Inc', 'Premium quality materials', '789 Premium Blvd, City, State', '555-0300', 'premium@example.com')
ON CONFLICT (name) DO NOTHING;

-- 11. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_supplies_location_id ON supplies(location_id);
CREATE INDEX IF NOT EXISTS idx_supplies_vendor_id ON supplies(vendor_id);
CREATE INDEX IF NOT EXISTS idx_supply_transactions_supply_id ON supply_transactions(supply_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_purchase_order_id ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_supply_id ON purchase_order_items(supply_id);
CREATE INDEX IF NOT EXISTS idx_sheet_cut_logs_material_id ON sheet_cut_logs(material_id);
CREATE INDEX IF NOT EXISTS idx_sheet_cut_logs_created_at ON sheet_cut_logs(created_at);

-- 12. Add triggers to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_vendors_updated_at 
    BEFORE UPDATE ON vendors 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_locations_updated_at 
    BEFORE UPDATE ON locations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_supplies_updated_at 
    BEFORE UPDATE ON supplies 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_purchase_orders_updated_at 
    BEFORE UPDATE ON purchase_orders 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 13. Make vendor_id nullable in supplies table
ALTER TABLE supplies ALTER COLUMN vendor_id DROP NOT NULL;

-- 14. Update any existing supplies to have empty default_vendor if null
UPDATE supplies SET default_vendor = '' WHERE default_vendor IS NULL;

-- 15. Create a function to generate PO numbers
CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT AS $$
DECLARE
    po_number TEXT;
    date_part TEXT;
    sequence_part TEXT;
BEGIN
    date_part := TO_CHAR(NOW(), 'YYYYMMDD');
    
    SELECT COALESCE(MAX(SUBSTRING(po_number FROM 12)), '000')
    INTO sequence_part
    FROM purchase_orders
    WHERE po_number LIKE 'PO-' || date_part || '-%';
    
    sequence_part := LPAD((COALESCE(sequence_part::INTEGER, 0) + 1)::TEXT, 3, '0');
    po_number := 'PO-' || date_part || '-' || sequence_part;
    
    RETURN po_number;
END;
$$ LANGUAGE plpgsql; 
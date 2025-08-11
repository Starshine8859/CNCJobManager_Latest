-- Enhanced Inventory Management Migration
-- This migration adds comprehensive inventory management features

-- 1. Create location categories table
CREATE TABLE IF NOT EXISTS location_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 2. Add category_id to locations table
ALTER TABLE locations ADD COLUMN IF NOT EXISTS category_id INTEGER REFERENCES location_categories(id);
ALTER TABLE locations ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3. Insert default location categories (based on Allmoxy patterns)
INSERT INTO location_categories (name, description, sort_order) VALUES
  ('Sheet Materials', 'Raw sheet materials like melamine, plywood, etc.', 1),
  ('Edgebandings', 'Edge banding materials', 2),
  ('Hardwood Materials', 'Solid hardwood materials', 3),
  ('Drawer Box Materials', 'Materials for drawer construction', 4),
  ('Drawer Glides', 'Drawer slide hardware', 5),
  ('Hinges / Plates / Handles', 'Cabinet hardware', 6),
  ('Accessories / Inserts', 'Miscellaneous hardware and accessories', 7),
  ('Other Inventory', 'General inventory items', 8)
ON CONFLICT (name) DO NOTHING;

-- 4. Update existing locations to have categories
UPDATE locations SET category_id = (SELECT id FROM location_categories WHERE name = 'Other Inventory' LIMIT 1)
WHERE category_id IS NULL;

-- 5. Enhance supply_locations table
ALTER TABLE supply_locations ADD COLUMN IF NOT EXISTS allocated_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE supply_locations ADD COLUMN IF NOT EXISTS available_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE supply_locations ADD COLUMN IF NOT EXISTS reorder_point INTEGER NOT NULL DEFAULT 0;
ALTER TABLE supply_locations ADD COLUMN IF NOT EXISTS suggested_order_qty INTEGER DEFAULT 0;
ALTER TABLE supply_locations ADD COLUMN IF NOT EXISTS last_reorder_date TIMESTAMP;
ALTER TABLE supply_locations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Remove old allocation_status column if it exists
ALTER TABLE supply_locations DROP COLUMN IF EXISTS allocation_status;

-- 6. Create inventory movements table
CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  supply_id INTEGER NOT NULL REFERENCES supplies(id),
  from_location_id INTEGER REFERENCES locations(id),
  to_location_id INTEGER REFERENCES locations(id),
  quantity INTEGER NOT NULL,
  movement_type TEXT NOT NULL, -- 'check_in', 'check_out', 'transfer', 'adjust'
  reference_type TEXT, -- 'purchase_order', 'job', 'manual', 'adjustment'
  reference_id INTEGER, -- ID of the reference (PO, job, etc.)
  notes TEXT,
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 7. Enhance vendors table
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS payment_terms TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS credit_limit INTEGER;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS rating INTEGER;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 8. Create vendor contacts table
CREATE TABLE IF NOT EXISTS vendor_contacts (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT, -- 'purchasing', 'sales', 'technical'
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 9. Create inventory alerts table
CREATE TABLE IF NOT EXISTS inventory_alerts (
  id SERIAL PRIMARY KEY,
  supply_id INTEGER NOT NULL REFERENCES supplies(id),
  location_id INTEGER NOT NULL REFERENCES locations(id),
  alert_type TEXT NOT NULL, -- 'low_stock', 'reorder_point', 'overstock'
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  is_resolved BOOLEAN DEFAULT false,
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 10. Enhance purchase orders table
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS expected_delivery_date TIMESTAMP;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS vendor_email TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS email_subject TEXT;
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS send_email BOOLEAN DEFAULT false;

-- Update status default to 'draft'
ALTER TABLE purchase_orders ALTER COLUMN status SET DEFAULT 'draft';

-- 11. Enhance purchase order items table
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS location_id INTEGER REFERENCES locations(id);
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS needed_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS received_quantity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE purchase_order_items ADD COLUMN IF NOT EXISTS order_in_groups INTEGER DEFAULT 1;

-- Rename quantity to order_quantity for clarity
ALTER TABLE purchase_order_items RENAME COLUMN quantity TO order_quantity;

-- 12. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_locations_category_id ON locations(category_id);
CREATE INDEX IF NOT EXISTS idx_supply_locations_active ON supply_locations(is_active);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_supply_id ON inventory_movements(supply_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON inventory_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON inventory_movements(created_at);
CREATE INDEX IF NOT EXISTS idx_vendor_contacts_vendor_id ON vendor_contacts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_supply_location ON inventory_alerts(supply_id, location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_alerts_unread ON inventory_alerts(is_read, is_resolved);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_location ON purchase_order_items(location_id);

-- 13. Add triggers for automatic quantity calculations
CREATE OR REPLACE FUNCTION update_supply_location_quantities()
RETURNS TRIGGER AS $$
BEGIN
  -- Update available quantity (on hand - allocated)
  UPDATE supply_locations 
  SET available_quantity = on_hand_quantity - allocated_quantity
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_supply_location_quantities
  AFTER UPDATE OF on_hand_quantity, allocated_quantity ON supply_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_supply_location_quantities();

-- 14. Add trigger for inventory alerts
CREATE OR REPLACE FUNCTION check_inventory_alerts()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for low stock alerts
  IF NEW.on_hand_quantity <= NEW.reorder_point AND NEW.on_hand_quantity > 0 THEN
    INSERT INTO inventory_alerts (supply_id, location_id, alert_type, message)
    VALUES (NEW.supply_id, NEW.location_id, 'reorder_point', 
            'Item has reached reorder point. Current stock: ' || NEW.on_hand_quantity);
  END IF;
  
  -- Check for out of stock alerts
  IF NEW.on_hand_quantity = 0 THEN
    INSERT INTO inventory_alerts (supply_id, location_id, alert_type, message)
    VALUES (NEW.supply_id, NEW.location_id, 'low_stock', 
            'Item is out of stock');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_inventory_alerts
  AFTER UPDATE OF on_hand_quantity ON supply_locations
  FOR EACH ROW
  EXECUTE FUNCTION check_inventory_alerts();

-- 15. Initialize existing data
-- Set reorder points to minimum quantities for existing records
UPDATE supply_locations 
SET reorder_point = minimum_quantity 
WHERE reorder_point = 0 AND minimum_quantity > 0;

-- Set available quantities
UPDATE supply_locations 
SET available_quantity = on_hand_quantity - allocated_quantity;

-- Mark all existing vendors as active
UPDATE vendors SET is_active = true WHERE is_active IS NULL;

-- Mark all existing locations as active
UPDATE locations SET is_active = true WHERE is_active IS NULL;

-- Mark all existing supply locations as active
UPDATE supply_locations SET is_active = true WHERE is_active IS NULL; 
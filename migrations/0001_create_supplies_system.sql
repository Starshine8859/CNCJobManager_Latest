-- Migration: Create supplies system and migrate existing data
-- This migration creates the new supplies system while preserving existing data

-- 1. Create new tables
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

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
  texture TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS supply_transactions (
  id SERIAL PRIMARY KEY,
  supply_id INTEGER REFERENCES supplies(id) NOT NULL,
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  description TEXT,
  job_id INTEGER REFERENCES jobs(id),
  user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

-- 2. Migrate existing color groups to locations
INSERT INTO locations (name)
SELECT DISTINCT name FROM color_groups
ON CONFLICT (name) DO NOTHING;

-- 3. Migrate existing colors to supplies
INSERT INTO supplies (name, hex_color, piece_size, quantity_on_hand, location_id, texture)
SELECT 
  c.name,
  c.hex_color,
  'sheet' as piece_size,
  0 as quantity_on_hand,
  l.id as location_id,
  c.texture
FROM colors c
LEFT JOIN color_groups cg ON c.group_id = cg.id
LEFT JOIN locations l ON cg.name = l.name;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_supplies_location_id ON supplies(location_id);
CREATE INDEX IF NOT EXISTS idx_supply_transactions_supply_id ON supply_transactions(supply_id);
CREATE INDEX IF NOT EXISTS idx_supply_transactions_job_id ON supply_transactions(job_id);
CREATE INDEX IF NOT EXISTS idx_supply_transactions_type ON supply_transactions(type);

-- 5. Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_supplies_updated_at 
    BEFORE UPDATE ON supplies 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column(); 
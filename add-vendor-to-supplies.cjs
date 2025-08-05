const { Pool } = require('pg');
require('dotenv').config();

async function addVendorToSupplies() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Starting vendor migration for supplies...');

    // First, create the vendors table if it doesn't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendors (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        contact_info TEXT,
        address TEXT,
        phone TEXT,
        email TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL
      )
    `);
    console.log('✅ Created vendors table');

    // Add vendor fields to supplies table
    await pool.query('ALTER TABLE supplies ADD COLUMN IF NOT EXISTS default_vendor_id INTEGER REFERENCES vendors(id)');
    await pool.query('ALTER TABLE supplies ADD COLUMN IF NOT EXISTS default_vendor_price INTEGER');
    console.log('✅ Added vendor columns to supplies table');

    // Create indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_supplies_default_vendor_id ON supplies(default_vendor_id)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name)');
    console.log('✅ Created indexes');

    // Insert some default vendors
    const vendorsResult = await pool.query(`
      INSERT INTO vendors (name, contact_info, address, phone, email) VALUES
        ('Retail Supplier', 'General retail supplier', '123 Retail St, City, State', '555-0100', 'retail@example.com'),
        ('Wholesale Materials Co', 'Wholesale materials supplier', '456 Wholesale Ave, City, State', '555-0200', 'wholesale@example.com'),
        ('Premium Supplies Inc', 'Premium quality materials', '789 Premium Blvd, City, State', '555-0300', 'premium@example.com')
      ON CONFLICT (name) DO NOTHING
      RETURNING id, name
    `);
    
    console.log('✅ Inserted default vendors:', vendorsResult.rows.map(r => r.name));

    // Count vendors
    const countResult = await pool.query('SELECT COUNT(*) as count FROM vendors');
    console.log(`✅ Total vendors in database: ${countResult.rows[0].count}`);

    console.log('🎉 Vendor migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

addVendorToSupplies(); 
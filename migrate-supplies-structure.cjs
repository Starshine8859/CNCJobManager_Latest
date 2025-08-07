const { Pool } = require('pg');
require('dotenv').config();

async function migrateSuppliesStructure() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔧 Migrating supplies database structure...');
    
    // Start a transaction
    await pool.query('BEGIN');
    
    // Step 1: Add missing columns to supplies table
    console.log('1. Adding missing columns to supplies table...');
    await pool.query(`
      ALTER TABLE supplies 
      ADD COLUMN IF NOT EXISTS part_number TEXT,
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS available_in_catalog BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS retail_price INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS image_url TEXT
    `);
    
    // Step 2: Create supply_vendors linking table
    console.log('2. Creating supply_vendors table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supply_vendors (
        id SERIAL PRIMARY KEY,
        supply_id INTEGER REFERENCES supplies(id) ON DELETE CASCADE,
        vendor_id INTEGER REFERENCES vendors(id) ON DELETE CASCADE,
        vendor_part_number TEXT,
        price INTEGER NOT NULL DEFAULT 0,
        is_preferred BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(supply_id, vendor_id)
      )
    `);
    
    // Step 3: Create supply_locations linking table
    console.log('3. Creating supply_locations table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supply_locations (
        id SERIAL PRIMARY KEY,
        supply_id INTEGER REFERENCES supplies(id) ON DELETE CASCADE,
        location_id INTEGER REFERENCES locations(id) ON DELETE CASCADE,
        on_hand_quantity INTEGER NOT NULL DEFAULT 0,
        minimum_quantity INTEGER NOT NULL DEFAULT 0,
        order_group_size INTEGER NOT NULL DEFAULT 1,
        allocation_status BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(supply_id, location_id)
      )
    `);
    
    // Step 4: Migrate existing vendor data
    console.log('4. Migrating existing vendor relationships...');
    const existingSupplies = await pool.query(`
      SELECT id, vendor_id, default_vendor_price 
      FROM supplies 
      WHERE vendor_id IS NOT NULL
    `);
    
    for (const supply of existingSupplies.rows) {
      if (supply.vendor_id) {
        await pool.query(`
          INSERT INTO supply_vendors (supply_id, vendor_id, price, is_preferred)
          VALUES ($1, $2, $3, TRUE)
          ON CONFLICT (supply_id, vendor_id) DO NOTHING
        `, [supply.id, supply.vendor_id, supply.default_vendor_price || 0]);
        
        console.log(`   Migrated vendor relationship for supply ${supply.id}`);
      }
    }
    
    // Step 5: Migrate existing location data
    console.log('5. Migrating existing location relationships...');
    const existingLocationSupplies = await pool.query(`
      SELECT id, location_id, quantity_on_hand
      FROM supplies 
      WHERE location_id IS NOT NULL
    `);
    
    for (const supply of existingLocationSupplies.rows) {
      if (supply.location_id) {
        await pool.query(`
          INSERT INTO supply_locations (supply_id, location_id, on_hand_quantity)
          VALUES ($1, $2, $3)
          ON CONFLICT (supply_id, location_id) DO NOTHING
        `, [supply.id, supply.location_id, supply.quantity_on_hand || 0]);
        
        console.log(`   Migrated location relationship for supply ${supply.id}`);
      }
    }
    
    // Step 6: Remove old columns from supplies table
    console.log('6. Removing old columns from supplies table...');
    await pool.query(`
      ALTER TABLE supplies 
      DROP COLUMN IF EXISTS vendor_id,
      DROP COLUMN IF EXISTS location_id,
      DROP COLUMN IF EXISTS default_vendor,
      DROP COLUMN IF EXISTS default_vendor_price
    `);
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the changes
    console.log('\n📊 Verifying new table structure:');
    
    // Check supplies table structure
    const suppliesColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'supplies' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nSupplies table structure:');
    suppliesColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Check supply_vendors table structure
    const supplyVendorsColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'supply_vendors' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nSupply_vendors table structure:');
    supplyVendorsColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Check supply_locations table structure
    const supplyLocationsColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'supply_locations' 
      ORDER BY ordinal_position
    `);
    
    console.log('\nSupply_locations table structure:');
    supplyLocationsColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Show migration results
    const supplyVendorsCount = await pool.query('SELECT COUNT(*) as count FROM supply_vendors');
    const supplyLocationsCount = await pool.query('SELECT COUNT(*) as count FROM supply_locations');
    
    console.log(`\n📈 Migration Results:`);
    console.log(`  - Supply-vendor relationships: ${supplyVendorsCount.rows[0].count}`);
    console.log(`  - Supply-location relationships: ${supplyLocationsCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    
    // Rollback on error
    try {
      await pool.query('ROLLBACK');
      console.log('🔄 Transaction rolled back');
    } catch (rollbackError) {
      console.error('Failed to rollback:', rollbackError.message);
    }
  } finally {
    await pool.end();
  }
}

migrateSuppliesStructure(); 
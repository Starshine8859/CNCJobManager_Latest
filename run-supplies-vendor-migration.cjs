const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting supplies vendor field migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '0003_update_supplies_vendor_field.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Supplies vendor field migration completed successfully!');
    
    // Verify the changes
    const columnsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'supplies' 
      AND column_name IN ('default_vendor', 'default_vendor_id')
      ORDER BY column_name
    `);
    
    console.log('📊 Supplies table columns after migration:');
    columnsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Check if default_vendor_id was removed
    const oldColumnExists = columnsResult.rows.some(row => row.column_name === 'default_vendor_id');
    if (!oldColumnExists) {
      console.log('✅ default_vendor_id column was successfully removed');
    }
    
    // Check if default_vendor was added
    const newColumnExists = columnsResult.rows.some(row => row.column_name === 'default_vendor');
    if (newColumnExists) {
      console.log('✅ default_vendor column was successfully added');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error); 
const { Pool } = require('pg');
require('dotenv').config();

async function fixSuppliesDB() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Fixing supplies table structure...');
    
    // Check current columns
    const columnsResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'supplies' 
      ORDER BY ordinal_position
    `);
    
    console.log('Current supplies table columns:');
    columnsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Add default_vendor column if it doesn't exist
    const hasDefaultVendor = columnsResult.rows.some(row => row.column_name === 'default_vendor');
    if (!hasDefaultVendor) {
      console.log('Adding default_vendor column...');
      await pool.query('ALTER TABLE supplies ADD COLUMN default_vendor TEXT');
      console.log('✅ Added default_vendor column');
    } else {
      console.log('✅ default_vendor column already exists');
    }
    
    // Remove default_vendor_id column if it exists
    const hasDefaultVendorId = columnsResult.rows.some(row => row.column_name === 'default_vendor_id');
    if (hasDefaultVendorId) {
      console.log('Removing default_vendor_id column...');
      // First drop any foreign key constraints
      try {
        await pool.query('ALTER TABLE supplies DROP CONSTRAINT IF EXISTS supplies_default_vendor_id_fkey');
      } catch (e) {
        console.log('No foreign key constraint to drop');
      }
      await pool.query('ALTER TABLE supplies DROP COLUMN default_vendor_id');
      console.log('✅ Removed default_vendor_id column');
    } else {
      console.log('✅ default_vendor_id column already removed');
    }
    
    // Update any null values to empty string
    await pool.query("UPDATE supplies SET default_vendor = '' WHERE default_vendor IS NULL");
    console.log('✅ Updated null values to empty string');
    
    console.log('🎉 Supplies table structure fixed!');
    
  } catch (error) {
    console.error('❌ Error fixing supplies table:', error.message);
  } finally {
    await pool.end();
  }
}

fixSuppliesDB(); 
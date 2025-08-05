const { Pool } = require('pg');
require('dotenv').config();

async function testSuppliesColumns() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Testing supplies table columns...');
    
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'supplies' 
      AND column_name IN ('default_vendor', 'default_vendor_id')
      ORDER BY column_name
    `);
    
    console.log('Supplies table columns:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
    // Check if default_vendor_id was removed
    const oldColumnExists = result.rows.some(row => row.column_name === 'default_vendor_id');
    if (!oldColumnExists) {
      console.log('✅ default_vendor_id column was successfully removed');
    }
    
    // Check if default_vendor was added
    const newColumnExists = result.rows.some(row => row.column_name === 'default_vendor');
    if (newColumnExists) {
      console.log('✅ default_vendor column was successfully added');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testSuppliesColumns(); 
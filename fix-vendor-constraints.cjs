const { Pool } = require('pg');
require('dotenv').config();

async function fixVendorConstraints() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Fixing vendor constraints...');
    
    // Check if vendors table has data
    const vendorsResult = await pool.query('SELECT COUNT(*) FROM vendors');
    console.log('Vendors count:', vendorsResult.rows[0].count);
    
    // Check supplies with invalid vendor_id
    const invalidSupplies = await pool.query(`
      SELECT s.id, s.name, s.vendor_id 
      FROM supplies s 
      LEFT JOIN vendors v ON s.vendor_id = v.id 
      WHERE s.vendor_id IS NOT NULL AND v.id IS NULL
    `);
    
    console.log('Supplies with invalid vendor_id:', invalidSupplies.rows.length);
    
    if (invalidSupplies.rows.length > 0) {
      console.log('Fixing invalid vendor_id references...');
      // Set vendor_id to NULL for supplies with invalid references
      await pool.query(`
        UPDATE supplies 
        SET vendor_id = NULL 
        WHERE vendor_id IS NOT NULL 
        AND vendor_id NOT IN (SELECT id FROM vendors)
      `);
      console.log('✅ Fixed invalid vendor_id references');
    }
    
    // Make vendor_id nullable if it's not already
    await pool.query('ALTER TABLE supplies ALTER COLUMN vendor_id DROP NOT NULL');
    console.log('✅ Made vendor_id nullable');
    
    console.log('🎉 Vendor constraints fixed!');
    
  } catch (error) {
    console.error('❌ Error fixing vendor constraints:', error.message);
  } finally {
    await pool.end();
  }
}

fixVendorConstraints(); 
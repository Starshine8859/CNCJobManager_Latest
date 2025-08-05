const { Pool } = require('pg');
require('dotenv').config();

async function testColorsToSupplies() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Testing colors to supplies migration...');
    
    // Check if old tables exist
    const oldTablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('colors', 'color_groups')
      ORDER BY table_name
    `);
    console.log('Old tables found:', oldTablesResult.rows.map(r => r.table_name));
    
    // Check if new tables exist
    const newTablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('supplies', 'locations', 'vendors')
      ORDER BY table_name
    `);
    console.log('New tables found:', newTablesResult.rows.map(r => r.table_name));
    
    // Check supplies data
    const suppliesResult = await pool.query('SELECT COUNT(*) FROM supplies');
    console.log('Supplies count:', suppliesResult.rows[0].count);
    
    if (suppliesResult.rows[0].count > 0) {
      const sampleSupply = await pool.query('SELECT * FROM supplies LIMIT 1');
      console.log('Sample supply:', JSON.stringify(sampleSupply.rows[0], null, 2));
    }
    
    // Check if colors table still has data
    const colorsResult = await pool.query(`
      SELECT COUNT(*) 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'colors'
    `);
    
    if (colorsResult.rows[0].count > 0) {
      const colorsCount = await pool.query('SELECT COUNT(*) FROM colors');
      console.log('Colors table still exists with', colorsCount.rows[0].count, 'records');
    }
    
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testColorsToSupplies(); 
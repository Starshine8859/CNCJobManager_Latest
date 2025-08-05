const { Pool } = require('pg');
require('dotenv').config();

async function testSuppliesAPI() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('Testing supplies API and database...');
    
    // Test 1: Check if supplies table exists and has data
    const suppliesResult = await pool.query('SELECT * FROM supplies LIMIT 5');
    console.log('✅ Supplies table exists with', suppliesResult.rows.length, 'records');
    
    if (suppliesResult.rows.length > 0) {
      console.log('Sample supply record:');
      console.log(JSON.stringify(suppliesResult.rows[0], null, 2));
    }
    
    // Test 2: Check table structure
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'supplies' 
      ORDER BY ordinal_position
    `);
    
    console.log('\n📊 Supplies table structure:');
    columnsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Test 3: Check for any foreign key constraints
    const constraintsResult = await pool.query(`
      SELECT tc.constraint_name, tc.table_name, kcu.column_name, 
             ccu.table_name AS foreign_table_name,
             ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'supplies'
    `);
    
    console.log('\n🔗 Foreign key constraints:');
    if (constraintsResult.rows.length === 0) {
      console.log('  No foreign key constraints found');
    } else {
      constraintsResult.rows.forEach(row => {
        console.log(`  - ${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testSuppliesAPI(); 
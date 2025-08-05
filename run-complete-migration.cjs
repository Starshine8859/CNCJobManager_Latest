const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runCompleteMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Starting complete database migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '0007_complete_with_sessions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Migration file loaded successfully');
    
    // Execute the migration
    console.log('⚙️  Executing migration...');
    await client.query(migrationSQL);
    
    console.log('✅ Complete migration executed successfully!');
    
    // Verify the migration results
    console.log('\n📊 Verifying migration results...');
    
    // Check tables
    const tables = ['vendors', 'locations', 'supplies', 'supply_transactions', 'purchase_orders', 'purchase_order_items', 'sheet_cut_logs'];
    
    for (const table of tables) {
      const result = await client.query(`SELECT COUNT(*) FROM ${table}`);
      console.log(`  - ${table}: ${result.rows[0].count} records`);
    }
    
    // Check if old tables still exist
    const oldTables = ['colors', 'color_groups'];
    for (const table of oldTables) {
      const result = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '${table}'
        );
      `);
      if (result.rows[0].exists) {
        console.log(`  - ⚠️  Old table '${table}' still exists (can be dropped later if needed)`);
      }
    }
    
    // Check supplies migration
    const suppliesResult = await client.query('SELECT COUNT(*) FROM supplies');
    const colorsResult = await client.query(`
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'colors'
    `);
    
    if (colorsResult.rows[0].count > 0) {
      const colorsCount = await client.query('SELECT COUNT(*) FROM colors');
      console.log(`  - 📦 Migrated ${suppliesResult.rows[0].count} supplies from ${colorsCount.rows[0].count} colors`);
    }
    
    // Check locations migration
    const locationsResult = await client.query('SELECT COUNT(*) FROM locations');
    const colorGroupsResult = await client.query(`
      SELECT COUNT(*) FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'color_groups'
    `);
    
    if (colorGroupsResult.rows[0].count > 0) {
      const colorGroupsCount = await client.query('SELECT COUNT(*) FROM color_groups');
      console.log(`  - 📍 Migrated ${locationsResult.rows[0].count} locations from ${colorGroupsCount.rows[0].count} color groups`);
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Test the application to ensure everything works');
    console.log('  2. If everything works, you can optionally drop old tables:');
    console.log('     - DROP TABLE IF EXISTS colors;');
    console.log('     - DROP TABLE IF EXISTS color_groups;');
    console.log('  3. Update your application to use the new inventory system');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runCompleteMigration().catch(console.error); 
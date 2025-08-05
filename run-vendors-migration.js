const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/cnc_job_manager'
});

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log('Starting vendors migration...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '0002_create_vendors_system.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the migration
    await client.query(migrationSQL);
    
    console.log('✅ Vendors migration completed successfully!');
    
    // Verify the tables were created
    const vendorsResult = await client.query('SELECT COUNT(*) FROM vendors');
    console.log(`📊 Vendors table has ${vendorsResult.rows[0].count} records`);
    
    const suppliesResult = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name = \'supplies\' AND column_name IN (\'default_vendor_id\', \'default_vendor_price\')');
    console.log(`📊 Supplies table has vendor columns: ${suppliesResult.rows.map(r => r.column_name).join(', ')}`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch(console.error); 
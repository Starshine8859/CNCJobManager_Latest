const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function runSessionsMigration() {
  const client = await pool.connect();
  
  try {
    console.log('🔐 Adding sessions table for authentication...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '0006_add_sessions_table.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📋 Migration file loaded successfully');
    
    // Execute the migration
    console.log('⚙️  Executing sessions migration...');
    await client.query(migrationSQL);
    
    console.log('✅ Sessions table created successfully!');
    
    // Verify the migration
    console.log('\n📊 Verifying sessions table...');
    
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'sessions'
      );
    `);
    
    if (tableExists.rows[0].exists) {
      console.log('✅ Sessions table exists');
      
      // Check table structure
      const columnsResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'sessions' 
        ORDER BY ordinal_position
      `);
      
      console.log('\n📋 Sessions table structure:');
      columnsResult.rows.forEach(row => {
        console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
      });
      
      // Check indexes
      const indexesResult = await client.query(`
        SELECT indexname, indexdef
        FROM pg_indexes 
        WHERE tablename = 'sessions'
        ORDER BY indexname
      `);
      
      console.log('\n🔗 Sessions table indexes:');
      indexesResult.rows.forEach(row => {
        console.log(`  - ${row.indexname}`);
      });
      
    } else {
      console.log('❌ Sessions table was not created');
    }
    
    console.log('\n🎉 Sessions migration completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Update your session store configuration to use the database');
    console.log('  2. Test user login/logout functionality');
    console.log('  3. Verify that sessions persist across server restarts');
    
  } catch (error) {
    console.error('❌ Sessions migration failed:', error.message);
    console.error(error.stack);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runSessionsMigration().catch(console.error); 
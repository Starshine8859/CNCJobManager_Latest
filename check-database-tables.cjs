const { Pool } = require('pg');
require('dotenv').config();

async function checkDatabaseTables() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('Checking database tables...');
    
    // Get all tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log('\n📋 All tables in database:');
    tablesResult.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.table_name}`);
    });
    
    // Check for session-related tables
    const sessionTables = tablesResult.rows.filter(row => 
      row.table_name.toLowerCase().includes('session')
    );
    
    if (sessionTables.length > 0) {
      console.log('\n🔐 Session-related tables found:');
      sessionTables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
    } else {
      console.log('\n⚠️  No session tables found!');
      console.log('   This might be using in-memory sessions or a different storage method.');
    }
    
    // Check for user authentication tables
    const authTables = tablesResult.rows.filter(row => 
      row.table_name.toLowerCase().includes('user') ||
      row.table_name.toLowerCase().includes('auth') ||
      row.table_name.toLowerCase().includes('login')
    );
    
    if (authTables.length > 0) {
      console.log('\n👤 Authentication-related tables:');
      authTables.forEach(table => {
        console.log(`  - ${table.table_name}`);
      });
    }
    
    console.log('\n✅ Database check completed!');
    
  } catch (error) {
    console.error('❌ Error checking database:', error.message);
  } finally {
    await pool.end();
  }
}

checkDatabaseTables(); 
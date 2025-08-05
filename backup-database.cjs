const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function backupDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('💾 Creating database backup...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(__dirname, 'backups');
    
    // Create backup directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    // Get all table names
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const backupData = {
      timestamp: timestamp,
      tables: {}
    };
    
    console.log('📋 Backing up tables...');
    
    for (const row of tablesResult.rows) {
      const tableName = row.table_name;
      console.log(`  - Backing up ${tableName}...`);
      
      // Get table structure
      const structureResult = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = '${tableName}' 
        ORDER BY ordinal_position
      `);
      
      // Get table data
      const dataResult = await client.query(`SELECT * FROM "${tableName}"`);
      
      backupData.tables[tableName] = {
        structure: structureResult.rows,
        data: dataResult.rows
      };
    }
    
    // Save backup to file
    const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    
    console.log(`✅ Backup saved to: ${backupFile}`);
    console.log(`📊 Total tables backed up: ${Object.keys(backupData.tables).length}`);
    
    // Show summary
    for (const [tableName, tableData] of Object.entries(backupData.tables)) {
      console.log(`  - ${tableName}: ${tableData.data.length} records`);
    }
    
    console.log('\n🔒 Backup completed successfully!');
    console.log('💡 You can now safely run the migration.');
    
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

backupDatabase().catch(console.error); 
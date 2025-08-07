const { drizzle } = require('drizzle-orm/postgres-js');
const postgres = require('postgres');
const dotenv = require('dotenv');

dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL not found in environment variables');
  process.exit(1);
}

const client = postgres(connectionString);
const db = drizzle(client);

async function checkSuppliesSchema() {
  try {
    console.log('🔍 Checking supplies table structure...\n');
    
    // Get table structure
    const result = await client`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'supplies' 
      ORDER BY ordinal_position;
    `;
    
    console.log('📋 Supplies table columns:');
    result.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'} ${col.column_default ? `[default: ${col.column_default}]` : ''}`);
    });
    
    // Check if table has any data
    const countResult = await client`SELECT COUNT(*) as count FROM supplies`;
    console.log(`\n📊 Total supplies: ${countResult[0].count}`);
    
    if (countResult[0].count > 0) {
      // Get sample data
      const sampleResult = await client`SELECT * FROM supplies LIMIT 1`;
      console.log('\n📄 Sample supply data:');
      console.log(JSON.stringify(sampleResult[0], null, 2));
    }
    
    // Check supply_vendors table
    console.log('\n🔍 Checking supply_vendors table structure...');
    const vendorResult = await client`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'supply_vendors' 
      ORDER BY ordinal_position;
    `;
    
    console.log('📋 Supply_vendors table columns:');
    vendorResult.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'} ${col.column_default ? `[default: ${col.column_default}]` : ''}`);
    });
    
    // Check supply_locations table
    console.log('\n🔍 Checking supply_locations table structure...');
    const locationResult = await client`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'supply_locations' 
      ORDER BY ordinal_position;
    `;
    
    console.log('📋 Supply_locations table columns:');
    locationResult.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'YES' ? '(nullable)' : '(not null)'} ${col.column_default ? `[default: ${col.column_default}]` : ''}`);
    });
    
  } catch (error) {
    console.error('❌ Error checking schema:', error);
  } finally {
    await client.end();
  }
}

checkSuppliesSchema(); 
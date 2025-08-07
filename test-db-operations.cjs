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

async function testDatabaseOperations() {
  try {
    console.log('🧪 Testing database operations...\n');
    
    // 1. Check if we have any supplies
    const supplies = await client`SELECT id, name FROM supplies LIMIT 1`;
    if (supplies.length === 0) {
      console.log('❌ No supplies found in database');
      return;
    }
    
    const supplyId = supplies[0].id;
    console.log(`✅ Found supply: ${supplies[0].name} (ID: ${supplyId})`);
    
    // 2. Check if we have any vendors
    const vendors = await client`SELECT id, company FROM vendors LIMIT 1`;
    if (vendors.length === 0) {
      console.log('❌ No vendors found in database');
      return;
    }
    
    const vendorId = vendors[0].id;
    console.log(`✅ Found vendor: ${vendors[0].company} (ID: ${vendorId})`);
    
    // 3. Check if we have any locations
    const locations = await client`SELECT id, name FROM locations LIMIT 1`;
    if (locations.length === 0) {
      console.log('❌ No locations found in database');
      return;
    }
    
    const locationId = locations[0].id;
    console.log(`✅ Found location: ${locations[0].name} (ID: ${locationId})`);
    
    // 4. Test inserting vendor relationship
    console.log('\n🔧 Testing supply_vendors insert...');
    try {
      await client`
        INSERT INTO supply_vendors (supply_id, vendor_id, vendor_part_number, price, is_preferred)
        VALUES (${supplyId}, ${vendorId}, 'TEST-PART-001', 1500, true)
      `;
      console.log('✅ Successfully inserted vendor relationship');
      
      // Verify it was inserted
      const vendorRel = await client`
        SELECT * FROM supply_vendors 
        WHERE supply_id = ${supplyId} AND vendor_id = ${vendorId}
      `;
      console.log('✅ Vendor relationship verified:', vendorRel[0]);
      
    } catch (error) {
      console.error('❌ Failed to insert vendor relationship:', error.message);
    }
    
    // 5. Test inserting location relationship
    console.log('\n🔧 Testing supply_locations insert...');
    try {
      await client`
        INSERT INTO supply_locations (supply_id, location_id, on_hand_quantity, minimum_quantity, order_group_size, allocation_status)
        VALUES (${supplyId}, ${locationId}, 50, 10, 5, false)
      `;
      console.log('✅ Successfully inserted location relationship');
      
      // Verify it was inserted
      const locationRel = await client`
        SELECT * FROM supply_locations 
        WHERE supply_id = ${supplyId} AND location_id = ${locationId}
      `;
      console.log('✅ Location relationship verified:', locationRel[0]);
      
    } catch (error) {
      console.error('❌ Failed to insert location relationship:', error.message);
    }
    
    // 6. Test deleting relationships
    console.log('\n🧹 Cleaning up test data...');
    await client`DELETE FROM supply_vendors WHERE supply_id = ${supplyId} AND vendor_part_number = 'TEST-PART-001'`;
    await client`DELETE FROM supply_locations WHERE supply_id = ${supplyId} AND on_hand_quantity = 50`;
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await client.end();
  }
}

testDatabaseOperations(); 
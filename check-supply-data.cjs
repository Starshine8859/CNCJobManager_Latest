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

async function checkSupplyData() {
  try {
    console.log('🔍 Checking supply data in database...\n');
    
    // Check supplies
    const supplies = await client`SELECT id, name FROM supplies LIMIT 5`;
    console.log('📋 Supplies found:', supplies.length);
    supplies.forEach(s => console.log(`  - ID: ${s.id}, Name: ${s.name}`));
    
    if (supplies.length === 0) {
      console.log('❌ No supplies found');
      return;
    }
    
    // Check supply_vendors for first supply
    const supplyId = supplies[0].id;
    console.log(`\n🔍 Checking vendor relationships for supply ${supplyId}...`);
    const vendorRels = await client`
      SELECT sv.*, v.company 
      FROM supply_vendors sv 
      JOIN vendors v ON sv.vendor_id = v.id 
      WHERE sv.supply_id = ${supplyId}
    `;
    console.log('📋 Vendor relationships found:', vendorRels.length);
    vendorRels.forEach(v => console.log(`  - Vendor: ${v.company}, Part: ${v.vendor_part_number}, Price: ${v.price}`));
    
    // Check supply_locations for first supply
    console.log(`\n🔍 Checking location relationships for supply ${supplyId}...`);
    const locationRels = await client`
      SELECT sl.*, l.name 
      FROM supply_locations sl 
      JOIN locations l ON sl.location_id = l.id 
      WHERE sl.supply_id = ${supplyId}
    `;
    console.log('📋 Location relationships found:', locationRels.length);
    locationRels.forEach(l => console.log(`  - Location: ${l.name}, On Hand: ${l.on_hand_quantity}, Min: ${l.minimum_quantity}`));
    
    // Check all vendors
    console.log('\n🔍 Checking all vendors...');
    const vendors = await client`SELECT id, company FROM vendors`;
    console.log('📋 Vendors found:', vendors.length);
    vendors.forEach(v => console.log(`  - ID: ${v.id}, Company: ${v.company}`));
    
    // Check all locations
    console.log('\n🔍 Checking all locations...');
    const locations = await client`SELECT id, name FROM locations`;
    console.log('📋 Locations found:', locations.length);
    locations.forEach(l => console.log(`  - ID: ${l.id}, Name: ${l.name}`));
    
  } catch (error) {
    console.error('❌ Error checking data:', error);
  } finally {
    await client.end();
  }
}

checkSupplyData(); 
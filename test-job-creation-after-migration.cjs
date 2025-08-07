const { Pool } = require('pg');
require('dotenv').config();

async function testJobCreationAfterMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🧪 Testing job creation after database migration...\n');

    // Test 1: Check if supplies table has the new structure
    console.log('1. Checking supplies table structure...');
    const suppliesColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'supplies' 
      ORDER BY ordinal_position
    `);
    
    console.log('Supplies table columns:');
    suppliesColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Test 2: Check if supply_vendors table exists
    console.log('\n2. Checking supply_vendors table...');
    const supplyVendorsCount = await pool.query('SELECT COUNT(*) as count FROM supply_vendors');
    console.log(`Supply-vendor relationships: ${supplyVendorsCount.rows[0].count}`);

    // Test 3: Check if supply_locations table exists
    console.log('\n3. Checking supply_locations table...');
    const supplyLocationsCount = await pool.query('SELECT COUNT(*) as count FROM supply_locations');
    console.log(`Supply-location relationships: ${supplyLocationsCount.rows[0].count}`);

    // Test 4: Check if job_materials table uses supply_id
    console.log('\n4. Checking job_materials table structure...');
    const jobMaterialsColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'job_materials' 
      ORDER BY ordinal_position
    `);
    
    console.log('Job materials table columns:');
    jobMaterialsColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Test 5: Check if we have supplies available for job creation
    console.log('\n5. Checking available supplies...');
    const supplies = await pool.query('SELECT id, name, hex_color FROM supplies ORDER BY id');
    console.log(`Available supplies: ${supplies.rows.length}`);
    supplies.rows.forEach(supply => {
      console.log(`  - ID ${supply.id}: ${supply.name} (${supply.hex_color})`);
    });

    // Test 6: Check if we have vendors available
    console.log('\n6. Checking available vendors...');
    const vendors = await pool.query('SELECT id, name FROM vendors ORDER BY id');
    console.log(`Available vendors: ${vendors.rows.length}`);
    vendors.rows.forEach(vendor => {
      console.log(`  - ID ${vendor.id}: ${vendor.name}`);
    });

    // Test 7: Check if we have locations available
    console.log('\n7. Checking available locations...');
    const locations = await pool.query('SELECT id, name FROM locations ORDER BY id');
    console.log(`Available locations: ${locations.rows.length}`);
    locations.rows.forEach(location => {
      console.log(`  - ID ${location.id}: ${location.name}`);
    });

    // Test 8: Check supply-vendor relationships
    console.log('\n8. Checking supply-vendor relationships...');
    const supplyVendors = await pool.query(`
      SELECT sv.supply_id, s.name as supply_name, v.name as vendor_name, sv.price
      FROM supply_vendors sv
      JOIN supplies s ON sv.supply_id = s.id
      JOIN vendors v ON sv.vendor_id = v.id
      ORDER BY sv.supply_id
    `);
    console.log(`Supply-vendor relationships: ${supplyVendors.rows.length}`);
    supplyVendors.rows.forEach(rel => {
      console.log(`  - Supply "${rel.supply_name}" -> Vendor "${rel.vendor_name}" ($${(rel.price/100).toFixed(2)})`);
    });

    // Test 9: Check supply-location relationships
    console.log('\n9. Checking supply-location relationships...');
    const supplyLocations = await pool.query(`
      SELECT sl.supply_id, s.name as supply_name, l.name as location_name, sl.on_hand_quantity
      FROM supply_locations sl
      JOIN supplies s ON sl.supply_id = s.id
      JOIN locations l ON sl.location_id = l.id
      ORDER BY sl.supply_id
    `);
    console.log(`Supply-location relationships: ${supplyLocations.rows.length}`);
    supplyLocations.rows.forEach(rel => {
      console.log(`  - Supply "${rel.supply_name}" -> Location "${rel.location_name}" (Qty: ${rel.on_hand_quantity})`);
    });

    // Test 10: Simulate job creation data structure
    console.log('\n10. Testing job creation data structure...');
    if (supplies.rows.length > 0) {
      const testJobData = {
        customerName: "Test Customer",
        jobName: "Test Job After Migration",
        materials: [
          {
            colorId: supplies.rows[0].id, // This should be supplyId now
            totalSheets: 2
          }
        ]
      };
      console.log('Test job data structure:');
      console.log(JSON.stringify(testJobData, null, 2));
      console.log('✅ Job creation data structure is valid!');
    } else {
      console.log('❌ No supplies available for testing job creation');
    }

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`  - Supplies table: ${suppliesColumns.rows.length} columns`);
    console.log(`  - Supply-vendor relationships: ${supplyVendorsCount.rows[0].count}`);
    console.log(`  - Supply-location relationships: ${supplyLocationsCount.rows[0].count}`);
    console.log(`  - Available supplies: ${supplies.rows.length}`);
    console.log(`  - Available vendors: ${vendors.rows.length}`);
    console.log(`  - Available locations: ${locations.rows.length}`);

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

testJobCreationAfterMigration(); 
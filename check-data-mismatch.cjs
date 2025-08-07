const { Pool } = require('pg');
require('dotenv').config();

async function checkDataMismatch() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔍 Checking data mismatch between colors and supplies...');
    
    // Check colors table
    console.log('\n📊 Colors table:');
    const colorsResult = await pool.query('SELECT id, name, hex_color FROM colors ORDER BY id');
    colorsResult.rows.forEach(row => {
      console.log(`  ID ${row.id}: ${row.name} (${row.hex_color})`);
    });
    
    // Check supplies table
    console.log('\n📊 Supplies table:');
    const suppliesResult = await pool.query('SELECT id, name, hex_color FROM supplies ORDER BY id');
    suppliesResult.rows.forEach(row => {
      console.log(`  ID ${row.id}: ${row.name} (${row.hex_color})`);
    });
    
    // Check job_materials table
    console.log('\n📊 Job materials table:');
    const jobMaterialsResult = await pool.query('SELECT id, color_id, total_sheets FROM job_materials ORDER BY id');
    jobMaterialsResult.rows.forEach(row => {
      console.log(`  ID ${row.id}: color_id=${row.color_id}, sheets=${row.total_sheets}`);
    });
    
    // Find mismatches
    console.log('\n🔍 Finding mismatches...');
    const mismatches = jobMaterialsResult.rows.filter(jm => {
      const colorExists = colorsResult.rows.some(c => c.id === jm.color_id);
      const supplyExists = suppliesResult.rows.some(s => s.id === jm.color_id);
      return !colorExists && !supplyExists;
    });
    
    if (mismatches.length > 0) {
      console.log('❌ Found job_materials with invalid color_id references:');
      mismatches.forEach(m => {
        console.log(`  Job material ID ${m.id} references color_id ${m.color_id} which doesn't exist in either table`);
      });
    } else {
      console.log('✅ All job_materials have valid color_id references');
    }
    
    // Check if we can map colors to supplies by name/hex
    console.log('\n🔍 Checking if colors can be mapped to supplies...');
    const colorToSupplyMap = {};
    
    colorsResult.rows.forEach(color => {
      const matchingSupply = suppliesResult.rows.find(supply => 
        supply.name === color.name || supply.hex_color === color.hex_color
      );
      if (matchingSupply) {
        colorToSupplyMap[color.id] = matchingSupply.id;
        console.log(`  Color ID ${color.id} (${color.name}) -> Supply ID ${matchingSupply.id} (${matchingSupply.name})`);
      } else {
        console.log(`  ❌ No matching supply found for Color ID ${color.id} (${color.name})`);
      }
    });
    
  } catch (error) {
    console.error('❌ Check failed:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

checkDataMismatch(); 
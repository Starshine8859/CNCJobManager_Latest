const { Pool } = require('pg');
require('dotenv').config();

async function fixJobMaterialsMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL
  });

  try {
    console.log('🔧 Fixing job_materials table migration...');
    
    // Start a transaction
    await pool.query('BEGIN');
    
    // Step 1: Add supply_id column
    console.log('1. Adding supply_id column...');
    await pool.query(`
      ALTER TABLE job_materials 
      ADD COLUMN IF NOT EXISTS supply_id INTEGER REFERENCES supplies(id)
    `);
    
    // Step 2: Get color to supply mapping
    console.log('2. Creating color to supply mapping...');
    const colorsResult = await pool.query('SELECT id, name, hex_color FROM colors ORDER BY id');
    const suppliesResult = await pool.query('SELECT id, name, hex_color FROM supplies ORDER BY id');
    
    const colorToSupplyMap = {};
    colorsResult.rows.forEach(color => {
      const matchingSupply = suppliesResult.rows.find(supply => 
        supply.name === color.name || supply.hex_color === color.hex_color
      );
      if (matchingSupply) {
        colorToSupplyMap[color.id] = matchingSupply.id;
        console.log(`   Color ID ${color.id} (${color.name}) -> Supply ID ${matchingSupply.id} (${matchingSupply.name})`);
      }
    });
    
    // Step 3: Update job_materials to use supply_id instead of color_id
    console.log('3. Updating job_materials to use supply_id...');
    let updatedCount = 0;
    
    for (const [colorId, supplyId] of Object.entries(colorToSupplyMap)) {
      const updateResult = await pool.query(`
        UPDATE job_materials 
        SET supply_id = $1 
        WHERE color_id = $2 AND supply_id IS NULL
      `, [supplyId, colorId]);
      
      updatedCount += updateResult.rowCount;
      console.log(`   Updated ${updateResult.rowCount} records: color_id ${colorId} -> supply_id ${supplyId}`);
    }
    
    console.log(`   Total updated: ${updatedCount} job_materials records`);
    
    // Step 4: Make supply_id NOT NULL
    console.log('4. Making supply_id NOT NULL...');
    await pool.query(`
      ALTER TABLE job_materials 
      ALTER COLUMN supply_id SET NOT NULL
    `);
    
    // Step 5: Drop the old color_id column
    console.log('5. Dropping old color_id column...');
    await pool.query(`
      ALTER TABLE job_materials 
      DROP COLUMN color_id
    `);
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the changes
    console.log('\n📊 Verifying new table structure:');
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'job_materials' 
      ORDER BY ordinal_position
    `);
    
    columnsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    
    // Check foreign key constraints
    const constraintsResult = await pool.query(`
      SELECT tc.constraint_name, tc.table_name, kcu.column_name, 
             ccu.table_name AS foreign_table_name,
             ccu.column_name AS foreign_column_name 
      FROM information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY' 
        AND tc.table_name = 'job_materials'
    `);
    
    console.log('\n🔗 Foreign key constraints:');
    constraintsResult.rows.forEach(row => {
      console.log(`  - ${row.column_name} -> ${row.foreign_table_name}.${row.foreign_column_name}`);
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error.stack);
    
    // Rollback on error
    try {
      await pool.query('ROLLBACK');
      console.log('🔄 Transaction rolled back');
    } catch (rollbackError) {
      console.error('Failed to rollback:', rollbackError.message);
    }
  } finally {
    await pool.end();
  }
}

fixJobMaterialsMigration(); 
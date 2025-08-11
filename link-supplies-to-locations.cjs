require('dotenv/config');
const { drizzle } = require('drizzle-orm/node-postgres');
const { Pool } = require('pg');
const { eq } = require('drizzle-orm');
const schema = require('./shared/schema.js');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
  });
  const db = drizzle(pool, { schema });

  // Get all supplies and locations
  const allSupplies = await db.select().from(schema.supplies);
  const allLocations = await db.select().from(schema.locations);

  let inserted = 0;
  for (const supply of allSupplies) {
    for (const location of allLocations) {
      // Check if this supply-location pair exists
      const exists = await db.select().from(schema.supplyLocations)
        .where(
          eq(schema.supplyLocations.supplyId, supply.id),
          eq(schema.supplyLocations.locationId, location.id)
        );
      if (exists.length === 0) {
        await db.insert(schema.supplyLocations).values({
          supplyId: supply.id,
          locationId: location.id,
          onHandQuantity: 0,
          allocatedQuantity: 0,
          availableQuantity: 0,
          minimumQuantity: 0,
          reorderPoint: 0,
          orderGroupSize: 1,
          isActive: true,
        });
        inserted++;
      }
    }
  }
  console.log(`Inserted ${inserted} missing supply-location links.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); 
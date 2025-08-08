import 'dotenv/config';
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";

async function testConnection() {
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    
    if (!process.env.DATABASE_URL) {
      console.error('DATABASE_URL environment variable is not set');
      return;
    }

    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    const db = drizzle(pool);
    
    // Test a simple query
    const result = await db.execute(sql`SELECT 1 as test`);
    console.log('Database connection successful:', result);
    
    await pool.end();
  } catch (error) {
    console.error('Database connection failed:', error);
  }
}

testConnection();

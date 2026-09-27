const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function runMigration() {
  console.log('--- Starting Database Migration & Connection Test ---');

  // 1. Read .env.local
  const envPath = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    console.error('Error: .env.local file not found!');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  let connectionString = '';

  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=') || trimmed.startsWith('DIRECT_URL=')) {
      const parts = trimmed.split('=');
      const val = parts.slice(1).join('=').replace(/^["']|["']$/g, '');
      if (val && !val.includes('[YOUR-PASSWORD]')) {
        connectionString = val;
        break;
      }
    }
  }

  if (!connectionString) {
    console.error('Error: Could not find valid DATABASE_URL or DIRECT_URL in .env.local');
    process.exit(1);
  }

  console.log('Connection string identified from .env.local.');

  // 2. Read schema.sql
  const schemaPath = path.join(__dirname, '..', 'supabase', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  // 3. Connect via pg
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('Successfully connected to PostgreSQL database!');

    // Test connection
    const pingRes = await client.query('SELECT 1 AS alive');
    console.log(`Database ping check: alive = ${pingRes.rows[0].alive}`);

    // Execute schema SQL
    console.log('Executing supabase/schema.sql migration...');
    await client.query(sql);
    console.log('Schema migration executed successfully!');

    // 4. Verify tables
    const tableVerification = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('clients', 'master_products', 'purchase_batches', 'client_demands', 'demand_items', 'employees', 'school_lists')
      ORDER BY table_name;
    `);

    const existingTables = tableVerification.rows.map(r => r.table_name);
    console.log('Verified existing public tables:', existingTables);

    // Record counts test
    for (const tbl of existingTables) {
      const cntRes = await client.query(`SELECT COUNT(*) FROM public.${tbl}`);
      console.log(`Table public.${tbl}: ${cntRes.rows[0].count} records`);
    }

    if (existingTables.length >= 7) {
      console.log('\nSUCCESS: All 7 database tables (clients, master_products, purchase_batches, client_demands, demand_items, employees, school_lists) exist and are ready for read/write operations!');
    } else {
      console.warn(`Warning: Expected 7 tables but found ${existingTables.length}: ${existingTables.join(', ')}`);
    }

  } catch (err) {
    console.error('Migration failure:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();

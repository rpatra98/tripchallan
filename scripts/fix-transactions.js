#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Check for required environment variables
if (!process.env.SUPABASE_POSTGRES_URL) {
  console.error('Missing SUPABASE_POSTGRES_URL environment variable');
  console.log('You need to add this to your .env file with your Supabase Postgres connection string');
  console.log('Format: postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres');
  process.exit(1);
}

// Create a PostgreSQL connection pool directly
const pool = new Pool({
  connectionString: process.env.SUPABASE_POSTGRES_URL
});

// Also create a Supabase client for API operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function fixTransactions() {
  try {
    console.log('Fixing transaction table and adding sample data...');

    // Load and execute the SQL script
    const migrationScript = fs.readFileSync(
      path.join(__dirname, '../migrations/fix_transaction_schema.sql'),
      'utf8'
    );
    
    console.log('Executing transaction schema migration...');
    await pool.query(migrationScript);
    console.log('Transaction schema migration completed successfully');
    
    // Check if the migration worked by counting transactions
    const { rows } = await pool.query('SELECT COUNT(*) FROM coin_transactions');
    console.log(`Transaction count after migration: ${rows[0].count}`);
    
    // If no transactions were created, try to create some using the seed script
    if (parseInt(rows[0].count) === 0) {
      console.log('No transactions found, running seed script...');
      
      const seedScript = fs.readFileSync(
        path.join(__dirname, './seed_data.sql'),
        'utf8'
      );
      
      await pool.query(seedScript);
      console.log('Seed script completed successfully');
      
      // Check again after seeding
      const { rows: afterRows } = await pool.query('SELECT COUNT(*) FROM coin_transactions');
      console.log(`Transaction count after seeding: ${afterRows[0].count}`);
    }
    
    // List a sample of transactions
    const { rows: sampleRows } = await pool.query(
      'SELECT * FROM coin_transactions ORDER BY created_at DESC LIMIT 3'
    );
    
    if (sampleRows.length > 0) {
      console.log('Sample transactions:');
      sampleRows.forEach((row, i) => {
        console.log(`Transaction ${i + 1}:`);
        console.log(`  ID: ${row.id}`);
        console.log(`  Amount: ${row.amount}`);
        console.log(`  From: ${row.from_user_id}`);
        console.log(`  To: ${row.to_user_id}`);
        console.log(`  Notes: ${row.notes}`);
        console.log(`  Created: ${row.created_at}`);
        console.log('');
      });
    } else {
      console.log('No sample transactions found');
    }
    
    console.log('Transaction fix process completed');
  } catch (error) {
    console.error('Error fixing transactions:', error);
  } finally {
    // Close the connection pool
    await pool.end();
  }
}

// Run the function
fixTransactions().catch(console.error); 
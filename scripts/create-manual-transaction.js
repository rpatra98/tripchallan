#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');

// Create a PostgreSQL connection pool directly
const pool = new Pool({
  connectionString: process.env.SUPABASE_POSTGRES_URL
});

async function createManualTransaction() {
  try {
    console.log('Creating manual transactions in Supabase using direct SQL...');

    // Get the SuperAdmin user ID
    const superAdminRes = await pool.query(
      "SELECT id, name FROM users WHERE email = 'superadmin@cbums.com' AND role = 'SUPERADMIN' LIMIT 1"
    );
    
    if (superAdminRes.rows.length === 0) {
      console.error('SuperAdmin not found');
      return;
    }
    
    const superAdmin = superAdminRes.rows[0];
    console.log(`Found SuperAdmin with ID: ${superAdmin.id}`);

    // Get admin user ID
    const adminRes = await pool.query(
      "SELECT id, name FROM users WHERE role = 'ADMIN' ORDER BY id LIMIT 1"
    );
    
    if (adminRes.rows.length === 0) {
      console.error('No admin users found');
      return;
    }
    
    const admin = adminRes.rows[0];
    console.log(`Found admin with ID: ${admin.id}`);

    // Create a test transaction directly in the database
    const now = new Date().toISOString();
    
    // Use the correct column names based on your actual schema
    const transactionRes = await pool.query(
      `INSERT INTO coin_transactions 
       (id, amount, from_user_id, to_user_id, notes, created_at, updated_at) 
       VALUES 
       (uuid_generate_v4(), $1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [10000, superAdmin.id, admin.id, 'Test transaction created via direct SQL', now, now]
    );
    
    if (transactionRes.rows.length > 0) {
      console.log(`Created transaction with ID: ${transactionRes.rows[0].id}`);
    } else {
      console.log('Transaction creation failed');
    }

    // Check what transactions exist
    const allTransactions = await pool.query(
      `SELECT * FROM coin_transactions ORDER BY created_at DESC LIMIT 5`
    );
    
    console.log(`Found ${allTransactions.rows.length} transactions`);
    
    if (allTransactions.rows.length > 0) {
      console.log('Sample transaction:', allTransactions.rows[0]);
      console.log('Column names:', Object.keys(allTransactions.rows[0]));
    }

  } catch (error) {
    console.error('Error creating manual transaction:', error);
  } finally {
    // Close the connection pool
    await pool.end();
  }
}

createManualTransaction(); 
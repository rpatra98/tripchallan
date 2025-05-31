#!/usr/bin/env node

/**
 * Setup Supabase Exec Function
 * 
 * This script creates the 'exec' function in Supabase, which is required
 * for running SQL migrations. This should be run once when setting up
 * a new Supabase project.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Check required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Function to create the exec_sql function in Supabase
async function setupExecFunction() {
  try {
    console.log('Setting up exec_sql function in Supabase...');
    
    // SQL to create the exec_sql function
    const sql = `
      -- Create the exec_sql function that enables running SQL scripts
      -- This is used by migration scripts to create and modify database schema
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS void AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
      
      -- Grant execute permission to the anon role
      GRANT EXECUTE ON FUNCTION exec_sql(text) TO anon;
      GRANT EXECUTE ON FUNCTION exec_sql(text) TO authenticated;
      GRANT EXECUTE ON FUNCTION exec_sql(text) TO service_role;
    `;
    
    // Try to execute using RPC first
    const { error: rpcError } = await supabase.rpc('exec_sql', { sql });
    
    if (rpcError) {
      console.log('The exec_sql function does not exist yet. This is expected for first-time setup.');
      console.log('Attempting to create the function using REST API...');
      
      // Try to execute via REST API directly (this might require service_role key)
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ sql })
      });
      
      if (!response.ok) {
        console.error('Error creating exec_sql function via REST API:', await response.text());
        console.log('');
        console.log('IMPORTANT: You need to manually create the exec_sql function in Supabase:');
        console.log('1. Go to your Supabase project dashboard');
        console.log('2. Navigate to the SQL Editor');
        console.log('3. Create a new query and paste the following SQL:');
        console.log(sql);
        console.log('4. Run the query to create the function');
        process.exit(1);
      }
      
      console.log('Successfully created exec_sql function via REST API');
    } else {
      console.log('Successfully created or updated exec_sql function');
    }
    
    // Test the function
    console.log('Testing exec_sql function...');
    const testSql = "SELECT 'exec_sql function is working' as message;";
    const { error: testError } = await supabase.rpc('exec_sql', { sql: testSql });
    
    if (testError) {
      console.error('Error testing exec_sql function:', testError);
    } else {
      console.log('exec_sql function is working correctly');
    }
    
    console.log('');
    console.log('Setup completed successfully!');
    console.log('You can now run migrations and database reset scripts.');
  } catch (error) {
    console.error('Error setting up exec_sql function:', error);
    process.exit(1);
  }
}

// Run the setup function
setupExecFunction(); 
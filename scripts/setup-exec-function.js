#!/usr/bin/env node

/**
 * Setup Supabase Exec Function
 * 
 * This script creates the 'exec' function in Supabase, which is required
 * for running SQL migrations. This should be run once when setting up
 * a new Supabase project.
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Create Supabase client with service role key (required for creating functions)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// SQL to create the exec function
const createExecFunctionSQL = `
  -- Create the exec function that allows executing arbitrary SQL
  CREATE OR REPLACE FUNCTION exec(query text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER -- This is important for allowing the function to run with elevated privileges
  AS $$
  BEGIN
    EXECUTE query;
  END;
  $$;

  -- Grant execute permission on the function
  GRANT EXECUTE ON FUNCTION exec TO service_role;
`;

async function setupExecFunction() {
  console.log('Setting up Supabase exec function...');
  
  try {
    // First check if Supabase connection works
    const { data, error: connectionError } = await supabase.from('_dummy_check_').select('*').limit(1).catch(() => {
      return { data: null, error: null }; // Expected to fail, just testing connection
    });
    
    if (connectionError && connectionError.code !== '42P01') { // 42P01 is table not found, which is expected
      console.error('❌ Connection to Supabase failed:', connectionError);
      process.exit(1);
    }
    
    console.log('✅ Connected to Supabase successfully');
    
    // We can't use the exec function yet (we're creating it), so we need to use Supabase's SQL API
    // First check if we can create SQL functions (test with a dummy query)
    console.log('Testing SQL function creation capability...');
    
    try {
      // Use PostgreSQL's built-in functions to execute our SQL
      // We can use the SQL API to run queries directly
      const { error: createError } = await supabase.rpc('exec', { query: 'SELECT 1' }).catch(err => {
        // If exec doesn't exist yet, this will fail with a specific error
        if (err.message && err.message.includes('function "exec" does not exist')) {
          console.log('Exec function does not exist yet, creating it...');
          return { error: null }; // Not a real error for our flow
        }
        return { error: err };
      });
      
      if (createError) {
        console.log('Exec function exists but returned an error:', createError);
        console.log('Re-creating the exec function...');
      } else {
        console.log('Exec function either exists and works, or needs to be created');
      }
      
      // Create the exec function using direct SQL API
      console.log('Creating exec function...');
      const { error: sqlError } = await supabase.rpc('postgres', { sql: createExecFunctionSQL }).catch(async err => {
        // If postgres RPC is not available, try another approach with REST API
        console.log('postgres RPC not available, trying alternate approach...');
        
        // Try using a Supabase function if available
        try {
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/create_exec_function`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ sql: createExecFunctionSQL })
          });
          
          if (!response.ok) {
            const error = await response.json();
            return { error };
          }
          
          return { error: null };
        } catch (fetchError) {
          console.error('Alternate approach failed:', fetchError);
          return { error: fetchError };
        }
      });
      
      if (sqlError) {
        console.error('❌ Failed to create exec function:', sqlError);
        console.log('Please create the exec function manually in the Supabase SQL editor:');
        console.log('---');
        console.log(createExecFunctionSQL);
        console.log('---');
        process.exit(1);
      }
      
      // Verify the function works
      console.log('Testing exec function...');
      const { error: testError } = await supabase.rpc('exec', { query: 'SELECT 1' });
      
      if (testError) {
        console.error('❌ Exec function was created but does not work:', testError);
        console.log('Please check the Supabase SQL editor and ensure the exec function exists and has proper permissions.');
        process.exit(1);
      }
      
      console.log('✅ Exec function is set up and working!');
      process.exit(0);
    } catch (error) {
      console.error('❌ Error setting up exec function:', error);
      console.log('Please create the exec function manually in the Supabase SQL editor:');
      console.log('---');
      console.log(createExecFunctionSQL);
      console.log('---');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

// Run the setup
setupExecFunction(); 
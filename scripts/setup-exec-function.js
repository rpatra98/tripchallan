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

// Check if required environment variables are set
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function setupExecFunction() {
  try {
    console.log('Setting up exec_sql function in Supabase...');
    
    // SQL to create the exec_sql function
    const createFunctionSQL = `
      -- Function to execute arbitrary SQL (use with caution, only for migrations)
      CREATE OR REPLACE FUNCTION exec_sql(sql text)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        EXECUTE sql;
      END;
      $$;
      
      -- Grant execute permission to authenticated users
      GRANT EXECUTE ON FUNCTION exec_sql(text) TO authenticated;
      
      SELECT 'exec_sql function created successfully' as message;
    `;
    
    // Execute the SQL directly
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: createFunctionSQL 
    }).catch(err => {
      // If function doesn't exist yet, create it using the REST API
      if (err.message && err.message.includes('function exec_sql(text) does not exist')) {
        console.log('exec_sql function does not exist yet, creating it using REST API...');
        
        // Alternative approach: use a direct SQL endpoint if available
        return supabase.from('_exec_sql_direct').select('*').limit(1);
      }
      return { error: err };
    });
    
    if (error) {
      console.error('Error setting up exec_sql function:', error);
      console.log('You may need to create this function manually in the Supabase SQL Editor:');
      console.log(createFunctionSQL);
      
      console.log('\nAlternatively, run the following SQL in the Supabase SQL Editor:');
      console.log(`
        -- Function to execute arbitrary SQL (use with caution, only for migrations)
        CREATE OR REPLACE FUNCTION exec_sql(sql text)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          EXECUTE sql;
        END;
        $$;
        
        -- Grant execute permission to authenticated users
        GRANT EXECUTE ON FUNCTION exec_sql(text) TO authenticated;
      `);
      
      process.exit(1);
    }
    
    console.log('exec_sql function set up successfully!');
    console.log('You can now run migrations using npm run migrate');
    
  } catch (error) {
    console.error('Error setting up exec_sql function:', error);
    process.exit(1);
  }
}

setupExecFunction(); 
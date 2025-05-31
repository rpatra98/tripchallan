#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Validate environment variables
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

// Function to fix foreign key relationships
async function fixForeignKeys() {
  try {
    console.log('Starting to fix foreign key relationships...');
    
    // Read the SQL migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', 'fix_foreign_keys.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Apply the migration using exec_sql RPC
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      console.error('Error applying migration:', error);
      
      // Try alternative approach with split statements
      console.log('Trying alternative approach...');
      
      // Split the SQL into individual statements
      const statements = migrationSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt && !stmt.startsWith('--'));
      
      for (const statement of statements) {
        if (!statement) continue;
        
        console.log(`Executing statement: ${statement.substring(0, 50)}...`);
        
        const { error: stmtError } = await supabase.rpc('exec_sql', {
          sql: statement + ';'
        });
        
        if (stmtError) {
          console.error(`Error executing statement: ${stmtError.message}`);
        }
      }
    } else {
      console.log('Foreign key relationships fixed successfully!');
    }
    
    // Now verify the foreign keys are set up correctly
    console.log('Verifying foreign key relationships...');
    
    // Check if coin_transactions table has the correct foreign keys
    const verifySQL = `
      SELECT conname, conrelid::regclass AS table_from, 
             a.attname AS column, confrelid::regclass AS table_to
      FROM pg_constraint c
      JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
      WHERE c.contype = 'f' 
        AND (c.conrelid::regclass::text = 'coin_transactions' 
             OR c.conrelid::regclass::text = 'activity_logs');
    `;
    
    const { data, error: verifyError } = await supabase.rpc('exec_sql', {
      sql: verifySQL
    });
    
    if (verifyError) {
      console.error('Error verifying foreign keys:', verifyError);
    } else {
      console.log('Foreign key verification complete.');
    }
    
    console.log('Foreign key fix operation completed.');
  } catch (error) {
    console.error('Error fixing foreign keys:', error);
    process.exit(1);
  }
}

// Run the main function
fixForeignKeys(); 
#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Check if required environment variables are set
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
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Function to ensure SuperAdmin has coins
async function ensureSuperAdminCoins() {
  try {
    console.log('Checking SuperAdmin user...');
    
    // Look for SuperAdmin
    const { data: superAdmin, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'superadmin@cbums.com')
      .eq('role', 'SUPERADMIN')
      .single();
    
    if (findError) {
      console.error('Error finding SuperAdmin:', findError);
      return false;
    }
    
    if (!superAdmin) {
      console.log('SuperAdmin not found');
      return false;
    }
    
    // Update SuperAdmin coins if needed
    if (superAdmin.coins < 1000000) {
      console.log(`Updating SuperAdmin coins from ${superAdmin.coins} to 1,000,000`);
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ coins: 1000000 })
        .eq('id', superAdmin.id);
      
      if (updateError) {
        console.error('Error updating SuperAdmin coins:', updateError);
        return false;
      }
      
      console.log('SuperAdmin coins updated successfully');
    } else {
      console.log(`SuperAdmin already has sufficient coins: ${superAdmin.coins}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error ensuring SuperAdmin coins:', error);
    return false;
  }
}

// Function to check tables and columns
async function checkTables() {
  try {
    console.log('Checking database tables and columns...');
    
    // Check coin_transactions table
    console.log('Checking coin_transactions table...');
    const { error: transactionError } = await supabase
      .from('coin_transactions')
      .select('count')
      .limit(1);
    
    if (transactionError) {
      console.error('Error with coin_transactions table:', transactionError);
    } else {
      console.log('coin_transactions table exists');
    }
    
    // Check activity_logs table
    console.log('Checking activity_logs table...');
    const { error: logsError } = await supabase
      .from('activity_logs')
      .select('count')
      .limit(1);
    
    if (logsError) {
      console.error('Error with activity_logs table:', logsError);
    } else {
      console.log('activity_logs table exists');
    }
    
    // Test relationship between coin_transactions and users
    console.log('Testing relationship between coin_transactions and users...');
    const { error: relationshipError } = await supabase
      .from('coin_transactions')
      .select(`
        *,
        fromUser:users!coin_transactions_from_user_id_fkey(id, name),
        toUser:users!coin_transactions_to_user_id_fkey(id, name)
      `)
      .limit(1);
    
    if (relationshipError) {
      console.error('Error with relationships:', relationshipError);
    } else {
      console.log('Relationships are properly configured');
    }
    
    return true;
  } catch (error) {
    console.error('Error checking tables:', error);
    return false;
  }
}

// Function to execute SQL directly (if available)
async function executeSQLScript() {
  try {
    console.log('Attempting to execute SQL script...');
    
    // This requires appropriate permissions, which the anon key might not have
    const sql = `
    -- Rename columns if they are using camelCase instead of snake_case
    DO $$ 
    BEGIN
      -- Check if fromUserId column exists
      IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'coin_transactions' AND column_name = 'fromUserId'
      ) THEN
        -- Rename the column to snake_case
        ALTER TABLE coin_transactions RENAME COLUMN "fromUserId" TO from_user_id;
      END IF;

      -- Check if toUserId column exists
      IF EXISTS (
        SELECT FROM information_schema.columns 
        WHERE table_name = 'coin_transactions' AND column_name = 'toUserId'
      ) THEN
        -- Rename the column to snake_case
        ALTER TABLE coin_transactions RENAME COLUMN "toUserId" TO to_user_id;
      END IF;
    END $$;
    `;
    
    // This would require a function to be set up in Supabase
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
      console.error('Error executing SQL script:', error);
      return false;
    }
    
    console.log('SQL script executed successfully');
    return true;
  } catch (error) {
    console.error('Error executing SQL script:', error);
    return false;
  }
}

// Main function
async function main() {
  try {
    console.log('Starting database fixes...');
    
    // Ensure SuperAdmin has coins
    await ensureSuperAdminCoins();
    
    // Check tables and relationships
    await checkTables();
    
    // Try to execute SQL script if needed
    try {
      await executeSQLScript();
    } catch (error) {
      console.log('SQL execution skipped or failed, continuing with other fixes');
    }
    
    console.log('Database fixes completed');
  } catch (error) {
    console.error('Error in main function:', error);
  }
}

// Run the main function
main(); 
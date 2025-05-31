#!/usr/bin/env node

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

// Function to fix SuperAdmin coin balance
async function fixSuperAdmin() {
  try {
    console.log('Fixing SuperAdmin coin balance...');
    
    // Find SuperAdmin user
    const { data: superAdmin, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'superadmin@cbums.com')
      .eq('role', 'SUPERADMIN')
      .single();
    
    if (findError) {
      console.error('Error finding SuperAdmin:', findError);
      return;
    }
    
    if (!superAdmin) {
      console.error('SuperAdmin not found in database');
      return;
    }
    
    console.log(`Found SuperAdmin user with ID: ${superAdmin.id}`);
    console.log(`Current coins: ${superAdmin.coins}`);
    
    // Update SuperAdmin coins to 1,000,000
    const { error: updateError } = await supabase
      .from('users')
      .update({ coins: 1000000 })
      .eq('id', superAdmin.id);
    
    if (updateError) {
      console.error('Error updating SuperAdmin coins:', updateError);
      return;
    }
    
    console.log('SuperAdmin coins updated to 1,000,000');
    
    // Record the transaction
    const adjustment = 1000000 - (superAdmin.coins || 0);
    
    if (adjustment === 0) {
      console.log('No adjustment needed, coins already at 1,000,000');
      return;
    }
    
    // Check if coin_transactions table exists
    const { error: checkTableError } = await supabase
      .from('coin_transactions')
      .select('count')
      .limit(1);
    
    if (checkTableError) {
      console.error('Error checking coin_transactions table:', checkTableError);
      console.log('Trying to create coin_transactions table...');
      
      // Create the table if it doesn't exist
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS coin_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
          amount INTEGER NOT NULL,
          reason TEXT NOT NULL,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
        );
      `;
      
      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          },
          body: JSON.stringify({ query: createTableSQL })
        });
        
        if (!response.ok) {
          console.error('Error creating coin_transactions table:', await response.text());
        } else {
          console.log('coin_transactions table created successfully');
        }
      } catch (err) {
        console.error('Error creating coin_transactions table:', err);
      }
    }
    
    // Record the transaction
    const now = new Date().toISOString();
    
    const { error: transactionError } = await supabase
      .from('coin_transactions')
      .insert({
        from_user_id: superAdmin.id,
        to_user_id: superAdmin.id,
        amount: Math.abs(adjustment),
        reason: 'SYSTEM',
        notes: 'System balance adjustment during initialization',
        created_at: now,
        updated_at: now
      });
    
    if (transactionError) {
      console.error('Error recording transaction:', transactionError);
    } else {
      console.log(`Successfully recorded adjustment transaction of ${Math.abs(adjustment)} coins`);
    }
    
    console.log('SuperAdmin coin balance fix completed successfully');
  } catch (error) {
    console.error('Error fixing SuperAdmin:', error);
  }
}

// Run the function
fixSuperAdmin(); 
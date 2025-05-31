#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function insertTestTransaction() {
  try {
    console.log('Trying to insert test transactions with different column naming conventions...');
    
    // Get the SuperAdmin user ID
    const { data: superAdmin } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'superadmin@cbums.com')
      .single();
    
    if (!superAdmin) {
      console.error('SuperAdmin not found');
      return;
    }
    
    // Try with camelCase column names
    try {
      console.log('\nAttempting insert with camelCase column names:');
      const { data: camelResult, error: camelError } = await supabase
        .from('coin_transactions')
        .insert({
          fromUserId: superAdmin.id,
          toUserId: superAdmin.id,
          amount: 1,
          notes: 'Test transaction with camelCase column names',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .select();
      
      if (camelError) {
        console.error('CamelCase insert failed:', camelError);
      } else {
        console.log('CamelCase insert succeeded:', camelResult);
      }
    } catch (camelError) {
      console.error('CamelCase insert exception:', camelError);
    }

    // Try with snake_case column names
    try {
      console.log('\nAttempting insert with snake_case column names:');
      const { data: snakeResult, error: snakeError } = await supabase
        .from('coin_transactions')
        .insert({
          from_user_id: superAdmin.id,
          to_user_id: superAdmin.id,
          amount: 1,
          notes: 'Test transaction with snake_case column names',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
      
      if (snakeError) {
        console.error('Snake_case insert failed:', snakeError);
      } else {
        console.log('Snake_case insert succeeded:', snakeResult);
      }
    } catch (snakeError) {
      console.error('Snake_case insert exception:', snakeError);
    }

    // Check what transactions exist
    console.log('\nChecking existing transactions:');
    const { data: transactions, error: fetchError } = await supabase
      .from('coin_transactions')
      .select('*')
      .order('id', { ascending: false })
      .limit(5);
    
    if (fetchError) {
      console.error('Error fetching transactions:', fetchError);
    } else {
      console.log('Recent transactions:', transactions);
      
      // Output the column names from the first transaction
      if (transactions && transactions.length > 0) {
        console.log('\nColumn names in the first transaction:');
        console.log(Object.keys(transactions[0]));
      }
    }
  } catch (error) {
    console.error('Error running script:', error);
  }
}

insertTestTransaction(); 
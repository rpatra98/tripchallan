#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function checkSchema() {
  try {
    console.log('Checking Supabase schema...');

    // Check coin_transactions table
    console.log('\nCOIN_TRANSACTIONS TABLE:');
    const { data: transactions, error: transactionsError } = await supabase
      .from('coin_transactions')
      .select('*')
      .limit(1);

    if (transactionsError) {
      console.error('Error fetching from coin_transactions:', transactionsError);
    } else {
      console.log('coin_transactions sample:', transactions);
    }

    // Execute raw SQL to get column information
    const { data: columns, error: columnsError } = await supabase.rpc('get_coin_transactions_columns');

    if (columnsError) {
      console.error('Error executing RPC function:', columnsError);
      
      // Alternative approach: try to insert with both column naming conventions and see which works
      console.log('\nTrying to insert with different column naming conventions...');
      
      // Try with snake_case
      const { data: snakeCase, error: snakeError } = await supabase
        .from('coin_transactions')
        .insert({
          from_user_id: '00000000-0000-0000-0000-000000000000',
          to_user_id: '00000000-0000-0000-0000-000000000000',
          amount: 1,
          notes: 'Test transaction with snake_case',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
      
      console.log('Snake case insert result:', snakeError ? `Error: ${snakeError.message}` : 'Success');
      
      // Try with camelCase
      const { data: camelCase, error: camelError } = await supabase
        .from('coin_transactions')
        .insert({
          fromUserId: '00000000-0000-0000-0000-000000000000',
          toUserId: '00000000-0000-0000-0000-000000000000',
          amount: 1,
          notes: 'Test transaction with camelCase',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .select();
      
      console.log('Camel case insert result:', camelError ? `Error: ${camelError.message}` : 'Success');
    } else {
      console.log('Column information:', columns);
    }

    // Check transactions count
    const { count, error: countError } = await supabase
      .from('coin_transactions')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('Error counting transactions:', countError);
    } else {
      console.log(`Total transactions: ${count}`);
    }

  } catch (error) {
    console.error('Error checking schema:', error);
  }
}

checkSchema(); 
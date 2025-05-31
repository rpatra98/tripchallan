#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function createTransactionsTable() {
  try {
    console.log('Creating coin_transactions table...');
    
    // Create the table using SQL query
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS coin_transactions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          amount INTEGER NOT NULL,
          from_user_id UUID REFERENCES users(id),
          to_user_id UUID REFERENCES users(id),
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_coin_transactions_from_user ON coin_transactions(from_user_id);
        CREATE INDEX IF NOT EXISTS idx_coin_transactions_to_user ON coin_transactions(to_user_id);
        CREATE INDEX IF NOT EXISTS idx_coin_transactions_created_at ON coin_transactions(created_at);
      `
    });
    
    if (error) {
      console.error('Error creating table:', error);
      return;
    }
    
    console.log('Table created successfully');
  } catch (error) {
    console.error('Error creating transactions table:', error);
  }
}

// Run the function
createTransactionsTable(); 
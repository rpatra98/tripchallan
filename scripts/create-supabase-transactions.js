#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function createTransactions() {
  try {
    console.log('Creating test transactions in Supabase...');

    // Get the SuperAdmin user
    const { data: superAdmin, error: superAdminError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'superadmin@cbums.com')
      .single();

    if (superAdminError) {
      console.error('Error finding SuperAdmin:', superAdminError);
      return;
    }

    console.log(`Found SuperAdmin with ID: ${superAdmin.id}`);

    // Get any existing admin users
    const { data: adminUsers, error: adminsError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'ADMIN');

    if (adminsError) {
      console.error('Error finding admin users:', adminsError);
      return;
    }

    console.log(`Found ${adminUsers.length} admin users`);

    if (adminUsers.length === 0) {
      console.log('No admin users found. Please run admin-setup.js first.');
      return;
    }

    // Create a few transactions
    const now = new Date();
    const transactions = [];

    for (const admin of adminUsers) {
      // Create an initial allocation transaction
      transactions.push({
        from_user_id: superAdmin.id,
        to_user_id: admin.id,
        amount: 50000,
        notes: `Initial coin allocation for ${admin.name}`,
        created_at: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString(), // 3 days ago
        updated_at: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString()
      });

      // Create a bonus transaction
      transactions.push({
        from_user_id: superAdmin.id,
        to_user_id: admin.id,
        amount: 5000,
        notes: `Bonus coins for ${admin.name}`,
        created_at: new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString(), // 2 days ago
        updated_at: new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString()
      });

      // Create a reclaim transaction
      transactions.push({
        from_user_id: admin.id,
        to_user_id: superAdmin.id,
        amount: 1000,
        notes: `Reclaimed coins from ${admin.name}`,
        created_at: new Date(now - 1000 * 60 * 60 * 24 * 1).toISOString(), // 1 day ago
        updated_at: new Date(now - 1000 * 60 * 60 * 24 * 1).toISOString()
      });
    }

    // Insert the transactions
    console.log(`Inserting ${transactions.length} transactions...`);
    const { data: inserted, error: insertError } = await supabase
      .from('coin_transactions')
      .insert(transactions)
      .select();

    if (insertError) {
      console.error('Error inserting transactions:', insertError);
      return;
    }

    console.log(`Successfully inserted ${inserted.length} transactions`);

    // Verify that the transactions were created
    const { data: allTransactions, error: countError } = await supabase
      .from('coin_transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (countError) {
      console.error('Error counting transactions:', countError);
      return;
    }

    console.log(`Total transactions in database: ${allTransactions.length}`);
    console.log('Sample transaction:', allTransactions[0]);

  } catch (error) {
    console.error('Error creating transactions:', error);
  }
}

createTransactions(); 
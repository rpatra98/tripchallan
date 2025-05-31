#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function createTestTransactions() {
  try {
    console.log('Finding users to create test transactions...');
    
    // Find the SuperAdmin
    const { data: superAdmin, error: superAdminError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'SUPERADMIN')
      .single();
    
    if (superAdminError) {
      console.error('Error finding SuperAdmin:', superAdminError);
      return;
    }

    console.log(`Found SuperAdmin: ${superAdmin.name} (${superAdmin.id})`);
    
    // Find all Admin users
    const { data: admins, error: adminsError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'ADMIN');
    
    if (adminsError) {
      console.error('Error finding Admins:', adminsError);
      return;
    }

    if (!admins || admins.length === 0) {
      console.log('No admin users found. Creating an admin user first...');
      
      // Create a new admin user if none exist
      const { data: newAdmin, error: createError } = await supabase
        .from('users')
        .insert({
          name: 'Test Admin',
          email: `admin${Date.now()}@example.com`,
          password: '$2b$12$WfpUktPuA8F32pgxjf6G9u3m.KYxatPBaJVtLD53Efq.O/cr1Go7G', // same hash as superadmin
          role: 'ADMIN',
          coins: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) {
        console.error('Error creating admin user:', createError);
        return;
      }
      
      console.log(`Created new admin: ${newAdmin.name} (${newAdmin.id})`);
      admins.push(newAdmin);
    }
    
    console.log(`Found ${admins.length} admin users`);
    
    // Create transactions for each admin
    for (const admin of admins) {
      console.log(`Creating transactions for admin: ${admin.name} (${admin.id})`);
      
      // 1. Create initial allocation transaction
      const allocationAmount = 50000;
      const allocationTimestamp = new Date(Date.now() - 3600000).toISOString(); // 1 hour ago
      
      const { data: allocation, error: allocationError } = await supabase
        .from('coin_transactions')
        .insert({
          fromUserId: superAdmin.id,
          toUserId: admin.id,
          amount: allocationAmount,
          notes: 'Initial coin allocation for admin creation',
          createdAt: allocationTimestamp,
          updatedAt: allocationTimestamp
        })
        .select()
        .single();
      
      if (allocationError) {
        console.error(`Error creating allocation transaction for ${admin.name}:`, allocationError);
        continue;
      }
      
      console.log(`Created allocation transaction: ${allocation.id} (${allocationAmount} coins)`);
      
      // 2. Create a give coins transaction
      const giveAmount = 10000;
      const giveTimestamp = new Date(Date.now() - 1800000).toISOString(); // 30 minutes ago
      
      const { data: give, error: giveError } = await supabase
        .from('coin_transactions')
        .insert({
          fromUserId: superAdmin.id,
          toUserId: admin.id,
          amount: giveAmount,
          notes: 'Bonus allocation for good performance',
          createdAt: giveTimestamp,
          updatedAt: giveTimestamp
        })
        .select()
        .single();
      
      if (giveError) {
        console.error(`Error creating give transaction for ${admin.name}:`, giveError);
        continue;
      }
      
      console.log(`Created give transaction: ${give.id} (${giveAmount} coins)`);
      
      // 3. Create a take coins transaction
      const takeAmount = 5000;
      const takeTimestamp = new Date(Date.now() - 900000).toISOString(); // 15 minutes ago
      
      const { data: take, error: takeError } = await supabase
        .from('coin_transactions')
        .insert({
          fromUserId: admin.id,
          toUserId: superAdmin.id,
          amount: takeAmount,
          notes: 'Reclaiming unused coins',
          createdAt: takeTimestamp,
          updatedAt: takeTimestamp
        })
        .select()
        .single();
      
      if (takeError) {
        console.error(`Error creating take transaction for ${admin.name}:`, takeError);
        continue;
      }
      
      console.log(`Created take transaction: ${take.id} (${takeAmount} coins)`);
      
      // Update the admin's coin balance
      const newBalance = admin.coins + allocationAmount + giveAmount - takeAmount;
      const { error: updateError } = await supabase
        .from('users')
        .update({ coins: newBalance, updatedAt: new Date().toISOString() })
        .eq('id', admin.id);
      
      if (updateError) {
        console.error(`Error updating admin coin balance for ${admin.name}:`, updateError);
        continue;
      }
      
      console.log(`Updated ${admin.name}'s coin balance to ${newBalance}`);
      
      // Update the SuperAdmin's coin balance
      const newSuperAdminBalance = superAdmin.coins - allocationAmount - giveAmount + takeAmount;
      const { error: superUpdateError } = await supabase
        .from('users')
        .update({ coins: newSuperAdminBalance, updatedAt: new Date().toISOString() })
        .eq('id', superAdmin.id);
      
      if (superUpdateError) {
        console.error('Error updating SuperAdmin coin balance:', superUpdateError);
        continue;
      }
      
      console.log(`Updated SuperAdmin's coin balance to ${newSuperAdminBalance}`);
    }
    
    console.log('Test transactions created successfully');
  } catch (error) {
    console.error('Error creating test transactions:', error);
  }
}

// Run the function
createTestTransactions(); 
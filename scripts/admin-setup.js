#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

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

// Function to create a test admin user
async function createTestAdmin() {
  try {
    console.log('Setting up a test admin user...');
    
    // First, find SuperAdmin to get their ID
    const { data: superAdmin, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'superadmin@cbums.com')
      .eq('role', 'SUPERADMIN')
      .single();
    
    if (findError) {
      console.error('Error finding SuperAdmin:', findError);
      console.log('Please ensure the SuperAdmin exists before running this script.');
      process.exit(1);
    }
    
    console.log(`Found SuperAdmin with ID: ${superAdmin.id}`);
    
    // Generate a password hash
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 12);
    
    // Create a new admin user
    const adminEmail = `admin${Date.now()}@example.com`;
    const { data: newAdmin, error: createError } = await supabase
      .from('users')
      .insert({
        name: 'Test Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'ADMIN',
        coins: 50000, // Initial coins
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Error creating admin user:', createError);
      process.exit(1);
    }
    
    console.log(`Created admin user: ${adminEmail} with ID: ${newAdmin.id}`);
    
    // Try to record the transaction with camelCase fields first
    const now = new Date().toISOString();
    try {
      const { data: camelTransaction, error: camelError } = await supabase
        .from('coin_transactions')
        .insert({
          fromUserId: superAdmin.id,
          toUserId: newAdmin.id,
          amount: 50000,
          notes: 'Initial coin allocation for new admin creation',
          createdAt: now,
          updatedAt: now
        })
        .select()
        .single();

      if (camelError) {
        console.error('Error recording transaction with camelCase:', camelError);
        
        // Try with snake_case if camelCase fails
        try {
          const { data: snakeTransaction, error: snakeError } = await supabase
            .from('coin_transactions')
            .insert({
              from_user_id: superAdmin.id,
              to_user_id: newAdmin.id,
              amount: 50000,
              notes: 'Initial coin allocation for new admin creation',
              created_at: now,
              updated_at: now
            })
            .select()
            .single();
            
          if (snakeError) {
            console.error('Error recording transaction with snake_case:', snakeError);
          } else {
            console.log(`Recorded admin creation transaction with ID: ${snakeTransaction.id}`);
            console.log(`${superAdmin.name} (SuperAdmin) transferred 50,000 coins to ${newAdmin.name} (Admin)`);
          }
        } catch (snakeException) {
          console.error('Exception recording transaction with snake_case:', snakeException);
        }
      } else {
        console.log(`Recorded admin creation transaction with ID: ${camelTransaction.id}`);
        console.log(`${superAdmin.name} (SuperAdmin) transferred 50,000 coins to ${newAdmin.name} (Admin)`);
      }
    } catch (err) {
      console.error('Exception recording transaction:', err);
    }
    
    // Update SuperAdmin's coin balance - NOTE: Users table uses camelCase
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        coins: superAdmin.coins - 50000,
        updatedAt: now
      })
      .eq('id', superAdmin.id);
    
    if (updateError) {
      console.error('Error updating SuperAdmin coins:', updateError);
    } else {
      console.log(`Updated SuperAdmin coins from ${superAdmin.coins} to ${superAdmin.coins - 50000}`);
    }
    
    console.log('Admin setup completed successfully');
  } catch (error) {
    console.error('Error in admin setup:', error);
    process.exit(1);
  }
}

// Run the function
createTestAdmin(); 
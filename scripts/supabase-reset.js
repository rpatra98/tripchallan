#!/usr/bin/env node

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
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

// Main function to reset and seed the database
async function resetAndSeedDatabase() {
  console.log('Starting database reset and seed process...');
  
  try {
    // Step 1: Create tables if they don't exist
    await createTables();
    
    // Step 2: Create or update the SuperAdmin user
    await ensureSuperAdmin();
    
    // Step 3: Apply any SQL migrations
    await applyMigrations();
    
    console.log('Database reset and seed completed successfully');
  } catch (error) {
    console.error('Error in database reset and seed process:', error);
    process.exit(1);
  }
}

// Create necessary database tables
async function createTables() {
  console.log('Creating tables if they don\'t exist...');
  
  try {
    // Check if users table exists
    const { error: checkUsersError } = await supabase
      .from('users')
      .select('count')
      .limit(1)
      .single();
    
    // Create users table if it doesn't exist
    if (checkUsersError) {
      console.log('Creating users table...');
      
      const { error: createUsersError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('SUPERADMIN', 'ADMIN', 'COMPANY', 'EMPLOYEE')),
            coins INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
          );
        `
      });
      
      if (createUsersError) {
        throw new Error(`Failed to create users table: ${createUsersError.message}`);
      }
    }
    
    // Check if coin_transactions table exists
    const { error: checkTransactionsError } = await supabase
      .from('coin_transactions')
      .select('count')
      .limit(1)
      .single();
    
    // Create coin_transactions table if it doesn't exist
    if (checkTransactionsError) {
      console.log('Creating coin_transactions table...');
      
      const { error: createTransactionsError } = await supabase.rpc('exec_sql', {
        sql: `
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
        `
      });
      
      if (createTransactionsError) {
        throw new Error(`Failed to create coin_transactions table: ${createTransactionsError.message}`);
      }
    }
    
    // Check if activity_logs table exists
    const { error: checkLogsError } = await supabase
      .from('activity_logs')
      .select('count')
      .limit(1)
      .single();
    
    // Create activity_logs table if it doesn't exist
    if (checkLogsError) {
      console.log('Creating activity_logs table...');
      
      const { error: createLogsError } = await supabase.rpc('exec_sql', {
        sql: `
          CREATE TABLE IF NOT EXISTS activity_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            action TEXT NOT NULL,
            target_resource_type TEXT,
            target_resource_id TEXT,
            details JSONB,
            ip_address TEXT,
            user_agent TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
          );
        `
      });
      
      if (createLogsError) {
        throw new Error(`Failed to create activity_logs table: ${createLogsError.message}`);
      }
    }
    
    console.log('All required tables created or verified');
  } catch (error) {
    console.error('Error creating tables:', error);
    throw error;
  }
}

// Create or update the SuperAdmin user
async function ensureSuperAdmin() {
  console.log('Ensuring SuperAdmin user exists...');
  
  try {
    // Look for existing SuperAdmin
    const { data: superAdmin, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'superadmin@cbums.com')
      .eq('role', 'SUPERADMIN')
      .single();
    
    // Generate hashed password
    const hashedPassword = await bcrypt.hash('superadmin123', 12);
    
    // If SuperAdmin exists, update coins if needed
    if (superAdmin) {
      console.log('SuperAdmin exists, checking coins...');
      
      if (superAdmin.coins < 1000000) {
        console.log(`Updating SuperAdmin coins from ${superAdmin.coins} to 1,000,000`);
        
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            coins: 1000000,
            updated_at: new Date().toISOString()
          })
          .eq('id', superAdmin.id);
        
        if (updateError) {
          throw new Error(`Failed to update SuperAdmin coins: ${updateError.message}`);
        }
        
        // Record the adjustment as a transaction
        await recordCoinAdjustment(superAdmin.id, 1000000 - superAdmin.coins);
        
        console.log('SuperAdmin coins updated successfully');
      } else {
        console.log(`SuperAdmin already has sufficient coins: ${superAdmin.coins}`);
      }
    } 
    // Create new SuperAdmin if doesn't exist
    else {
      console.log('SuperAdmin not found, creating one...');
      
      const { data: newAdmin, error: createError } = await supabase
        .from('users')
        .insert({
          name: 'Super Admin',
          email: 'superadmin@cbums.com',
          password: hashedPassword,
          role: 'SUPERADMIN',
          coins: 1000000,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (createError) {
        throw new Error(`Failed to create SuperAdmin: ${createError.message}`);
      }
      
      console.log('SuperAdmin created successfully with 1,000,000 coins');
      
      // Record the initial allocation as a transaction
      await recordCoinAdjustment(newAdmin.id, 1000000);
    }
  } catch (error) {
    console.error('Error ensuring SuperAdmin exists:', error);
    throw error;
  }
}

// Record a coin adjustment transaction
async function recordCoinAdjustment(userId, amount) {
  try {
    // Create a self-transaction for system adjustments
    const { error } = await supabase
      .from('coin_transactions')
      .insert({
        from_user_id: userId, // System adjustment
        to_user_id: userId,
        amount: Math.abs(amount),
        reason: 'SYSTEM',
        notes: 'System balance adjustment during initialization',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error recording coin adjustment transaction:', error);
    } else {
      console.log(`Recorded coin adjustment transaction of ${amount} coins for user ${userId}`);
    }
  } catch (error) {
    console.error('Error recording coin adjustment:', error);
  }
}

// Apply any SQL migrations from the migrations folder
async function applyMigrations() {
  console.log('Applying SQL migrations...');
  
  try {
    const migrationsDir = path.join(process.cwd(), 'migrations');
    
    // Check if migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found, skipping migrations');
      return;
    }
    
    // Get all SQL files in migrations directory
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to apply in order
    
    if (migrationFiles.length === 0) {
      console.log('No SQL migration files found, skipping migrations');
      return;
    }
    
    console.log(`Found ${migrationFiles.length} migration files to apply`);
    
    // Apply each migration
    for (const file of migrationFiles) {
      console.log(`Applying migration: ${file}`);
      
      const migrationContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      
      // Apply the migration using exec_sql RPC
      const { error } = await supabase.rpc('exec_sql', {
        sql: migrationContent
      });
      
      if (error) {
        console.error(`Error applying migration ${file}:`, error);
        // Continue with other migrations even if one fails
      } else {
        console.log(`Successfully applied migration: ${file}`);
      }
    }
    
    console.log('All migrations applied');
  } catch (error) {
    console.error('Error applying migrations:', error);
    throw error;
  }
}

// Run the main function
resetAndSeedDatabase(); 
#!/usr/bin/env node

/**
 * Supabase Database Reset and Seed Script
 * 
 * This script:
 * 1. Wipes relevant Supabase tables
 * 2. Creates required schema
 * 3. Seeds initial SuperAdmin user
 * 4. Creates test data including admin creation transactions
 * 
 * Usage: 
 * - Development: npm run db:reset
 * - Production: NODE_ENV=production npm run db:reset
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const fs = require('fs');
const path = require('path');

// Environment detection
const isProduction = process.env.NODE_ENV === 'production';
console.log(`Running in ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'} mode`);

// Check required environment variables
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY'
];

if (isProduction) {
  // Additional keys required for production
  requiredEnvVars.push('SUPABASE_SERVICE_ROLE_KEY');
}

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Create Supabase client with appropriate credentials
const supabase = isProduction
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

// List of tables that should be reset
const tablesToReset = [
  'activity_logs',
  'coin_transactions',
  'trips',
  'users'
];

// Main function
async function resetAndSeedDatabase() {
  try {
    console.log('Starting database reset and seed process...');
    
    // 1. Reset tables (in reverse order to avoid foreign key constraints)
    console.log('Clearing existing data...');
    for (const table of [...tablesToReset].reverse()) {
      console.log(`Clearing table: ${table}`);
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        console.error(`Error clearing table ${table}:`, error);
      }
    }
    
    // 2. Set up database schema by executing migrations
    console.log('Setting up database schema...');
    await applyMigrations();
    
    // 3. Create SuperAdmin user
    console.log('Creating SuperAdmin user...');
    const superAdminId = await createSuperAdmin();
    
    if (!superAdminId) {
      console.error('Failed to create SuperAdmin user');
      process.exit(1);
    }
    
    // 4. Create test data (only in development)
    if (!isProduction) {
      console.log('Creating test data...');
      await createTestData(superAdminId);
    }
    
    console.log('Database reset and seed completed successfully!');
  } catch (error) {
    console.error('Error in database reset and seed process:', error);
    process.exit(1);
  }
}

// Apply migrations from the migrations directory
async function applyMigrations() {
  try {
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    
    // Check if migrations directory exists
    if (!fs.existsSync(migrationsDir)) {
      console.log('No migrations directory found');
      return;
    }
    
    // Get all SQL files and sort them
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();
    
    console.log(`Found ${migrationFiles.length} migration files`);
    
    // Apply each migration
    for (const file of migrationFiles) {
      console.log(`Applying migration: ${file}`);
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');
      
      // Split the SQL file into separate statements
      const statements = sql.split(';').filter(stmt => stmt.trim());
      
      for (const statement of statements) {
        if (statement.trim()) {
          const { error } = await supabase.rpc('exec_sql', { sql: statement.trim() });
          
          if (error) {
            console.error(`Error executing SQL from ${file}:`, error);
            console.error('SQL statement:', statement.trim());
          }
        }
      }
    }
    
    console.log('All migrations applied successfully');
  } catch (error) {
    console.error('Error applying migrations:', error);
    throw error;
  }
}

// Create SuperAdmin user
async function createSuperAdmin() {
  try {
    const password = 'superadmin123';
    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();
    
    // Check if SuperAdmin already exists
    const { data: existingAdmin } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'superadmin@cbums.com')
      .eq('role', 'SUPERADMIN');
    
    if (existingAdmin && existingAdmin.length > 0) {
      console.log('SuperAdmin already exists, updating...');
      
      // Update existing SuperAdmin
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: 'Super Admin',
          password: hashedPassword,
          coins: 1000000,
          updated_at: now
        })
        .eq('email', 'superadmin@cbums.com')
        .eq('role', 'SUPERADMIN');
      
      if (updateError) {
        console.error('Error updating SuperAdmin:', updateError);
        return null;
      }
      
      console.log('SuperAdmin updated successfully');
      return existingAdmin[0].id;
    }
    
    // Create new SuperAdmin
    const { data: newAdmin, error: createError } = await supabase
      .from('users')
      .insert({
        name: 'Super Admin',
        email: 'superadmin@cbums.com',
        password: hashedPassword,
        role: 'SUPERADMIN',
        coins: 1000000,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Error creating SuperAdmin:', createError);
      return null;
    }
    
    console.log(`SuperAdmin created with ID: ${newAdmin.id}`);
    
    // Record initial coin allocation as a transaction
    const { error: transactionError } = await supabase
      .from('coin_transactions')
      .insert({
        from_user_id: newAdmin.id,
        to_user_id: newAdmin.id,
        amount: 1000000,
        notes: 'Initial coin allocation for SuperAdmin',
        created_at: now,
        updated_at: now
      });
    
    if (transactionError) {
      console.error('Error recording initial coin transaction:', transactionError);
    }
    
    return newAdmin.id;
  } catch (error) {
    console.error('Error in createSuperAdmin:', error);
    return null;
  }
}

// Create test data (admins, transactions, etc.)
async function createTestData(superAdminId) {
  try {
    if (!superAdminId) {
      console.error('Cannot create test data without SuperAdmin ID');
      return;
    }
    
    // Create a test admin
    const adminEmail = 'admin@cbums.com';
    const password = 'admin123';
    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();
    
    const { data: newAdmin, error: createError } = await supabase
      .from('users')
      .insert({
        name: 'Test Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'ADMIN',
        coins: 50000,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Error creating test admin:', createError);
      return;
    }
    
    console.log(`Test admin created with ID: ${newAdmin.id}`);
    
    // Record admin creation transaction
    const { error: transactionError } = await supabase
      .from('coin_transactions')
      .insert({
        from_user_id: superAdminId,
        to_user_id: newAdmin.id,
        amount: 50000,
        notes: 'Initial coin allocation for new admin creation',
        created_at: now,
        updated_at: now
      });
    
    if (transactionError) {
      console.error('Error recording admin creation transaction:', transactionError);
    } else {
      console.log('Admin creation transaction recorded successfully');
    }
    
    // Create additional test data as needed...
    
  } catch (error) {
    console.error('Error creating test data:', error);
  }
}

// Run the main function
resetAndSeedDatabase(); 
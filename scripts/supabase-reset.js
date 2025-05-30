#!/usr/bin/env node

const { execSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Check if required environment variables are set
const requiredEnvVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY'
];

const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
if (missingEnvVars.length > 0) {
  console.error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function resetDatabase() {
  try {
    console.log('Starting database reset and seeding process...');
    
    // Step 1: Apply all migrations
    console.log('Applying migrations...');
    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Sort to ensure migrations run in order
    
    for (const migrationFile of migrationFiles) {
      console.log(`Applying migration: ${migrationFile}`);
      const migrationPath = path.join(migrationsDir, migrationFile);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      // Execute the SQL using Supabase's REST API
      const { error } = await supabase.rpc('exec_sql', { sql });
      if (error) {
        console.error(`Error applying migration ${migrationFile}:`, error);
        throw error;
      }
      console.log(`Migration ${migrationFile} applied successfully`);
    }
    
    // Step 2: Clean existing data (if needed)
    console.log('Cleaning existing data...');
    
    // Delete all data in reverse order of dependencies
    const tables = [
      'coin_transactions',
      'activity_logs',
      'users'
    ];
    
    for (const table of tables) {
      console.log(`Cleaning table: ${table}`);
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error && error.code !== 'PGRST116') {
        console.error(`Error cleaning table ${table}:`, error);
        // Continue with other tables even if one fails
      }
    }
    
    // Step 3: Seed initial data
    console.log('Seeding initial data...');
    
    // Create SuperAdmin user
    const hashedPassword = await bcrypt.hash('superadmin123', 12);
    const superAdminEmail = 'superadmin@cbums.com';
    
    // Check if SuperAdmin already exists
    const { data: existingSuperAdmin, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', superAdminEmail)
      .single();
    
    if (checkError && checkError.code !== 'PGRST116') {
      console.error('Error checking for existing SuperAdmin:', checkError);
    }
    
    if (existingSuperAdmin) {
      console.log('SuperAdmin user already exists, updating...');
      
      const { error: updateError } = await supabase
        .from('users')
        .update({
          name: 'Super Admin',
          password: hashedPassword,
          role: 'SUPERADMIN',
          coins: 1000000,
          updatedAt: new Date().toISOString()
        })
        .eq('email', superAdminEmail);
      
      if (updateError) {
        console.error('Error updating SuperAdmin:', updateError);
        throw updateError;
      }
    } else {
      console.log('Creating new SuperAdmin user...');
      
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          name: 'Super Admin',
          email: superAdminEmail,
          password: hashedPassword,
          role: 'SUPERADMIN',
          coins: 1000000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('Error creating SuperAdmin:', insertError);
        throw insertError;
      }
    }
    
    console.log('Database reset and seeding completed successfully!');
    console.log('SuperAdmin credentials:');
    console.log('  Email: superadmin@cbums.com');
    console.log('  Password: superadmin123');
    
  } catch (error) {
    console.error('Error resetting database:', error);
    process.exit(1);
  }
}

resetDatabase(); 
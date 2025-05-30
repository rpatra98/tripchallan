#!/usr/bin/env node

/**
 * Supabase Migration Script
 * 
 * This script applies migrations to a Supabase database.
 * It is meant to replace the old Neon/Prisma migration script.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Create Supabase client with service role key (required for management operations)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

// Create the initial schema if it doesn't exist
async function createInitialSchema() {
  console.log('Checking if initial schema needs to be created...');
  
  try {
    // Check if users table exists
    const { error: usersTableError } = await supabase.from('users').select('count').limit(1);
    
    if (usersTableError && usersTableError.code === '42P01') { // Table doesn't exist
      console.log('Users table does not exist. Creating initial schema...');
      
      // Create enums
      const createEnumsSQL = `
        -- Create enums
        CREATE TYPE IF NOT EXISTS "UserRole" AS ENUM ('SUPERADMIN', 'ADMIN', 'COMPANY', 'EMPLOYEE');
        CREATE TYPE IF NOT EXISTS "EmployeeSubrole" AS ENUM ('OPERATOR', 'DRIVER', 'TRANSPORTER', 'GUARD');
        CREATE TYPE IF NOT EXISTS "SessionStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');
        CREATE TYPE IF NOT EXISTS "TransactionReason" AS ENUM ('SESSION_START', 'COIN_ALLOCATION', 'MANUAL_TOPUP', 'ADMIN_TRANSFER', 'EMPLOYEE_TRANSFER');
        CREATE TYPE IF NOT EXISTS "ActivityAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'TRANSFER', 'ALLOCATE', 'VIEW');
      `;
      
      // Create tables
      const createTablesSQL = `
        -- Create companies table
        CREATE TABLE IF NOT EXISTS "companies" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "name" TEXT NOT NULL,
          "email" TEXT NOT NULL UNIQUE,
          "address" TEXT,
          "phone" TEXT,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create users table
        CREATE TABLE IF NOT EXISTS "users" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "name" TEXT NOT NULL,
          "email" TEXT NOT NULL UNIQUE,
          "password" TEXT NOT NULL,
          "role" "UserRole" NOT NULL,
          "subrole" "EmployeeSubrole",
          "companyId" UUID REFERENCES "companies"("id") ON DELETE SET NULL,
          "coins" INTEGER NOT NULL DEFAULT 0,
          "createdById" UUID REFERENCES "users"("id") ON DELETE SET NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create coin_transactions table
        CREATE TABLE IF NOT EXISTS "coin_transactions" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "fromUserId" UUID NOT NULL REFERENCES "users"("id"),
          "toUserId" UUID NOT NULL REFERENCES "users"("id"),
          "amount" INTEGER NOT NULL,
          "reasonText" TEXT,
          "reason" "TransactionReason",
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create sessions table
        CREATE TABLE IF NOT EXISTS "sessions" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "createdById" UUID NOT NULL REFERENCES "users"("id"),
          "companyId" UUID NOT NULL REFERENCES "companies"("id"),
          "source" TEXT NOT NULL,
          "destination" TEXT NOT NULL,
          "status" "SessionStatus" NOT NULL DEFAULT 'PENDING'
        );

        -- Create seals table
        CREATE TABLE IF NOT EXISTS "seals" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "sessionId" UUID NOT NULL REFERENCES "sessions"("id"),
          "barcode" TEXT NOT NULL,
          "scannedAt" TIMESTAMP WITH TIME ZONE,
          "verified" BOOLEAN NOT NULL DEFAULT false,
          "verifiedById" UUID REFERENCES "users"("id")
        );

        -- Create comments table
        CREATE TABLE IF NOT EXISTS "comments" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "sessionId" UUID NOT NULL REFERENCES "sessions"("id"),
          "userId" UUID NOT NULL REFERENCES "users"("id"),
          "message" TEXT NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create activity_logs table
        CREATE TABLE IF NOT EXISTS "activity_logs" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "userId" UUID NOT NULL REFERENCES "users"("id"),
          "action" "ActivityAction" NOT NULL,
          "details" JSONB,
          "targetUserId" UUID REFERENCES "users"("id"),
          "targetResourceId" TEXT,
          "targetResourceType" TEXT,
          "ipAddress" TEXT,
          "userAgent" TEXT,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create operator_permissions table
        CREATE TABLE IF NOT EXISTS "operator_permissions" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "userId" UUID NOT NULL REFERENCES "users"("id"),
          "permission" TEXT NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        -- Create vehicles table 
        CREATE TABLE IF NOT EXISTS "vehicles" (
          "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "companyId" UUID NOT NULL REFERENCES "companies"("id"),
          "registrationNumber" TEXT NOT NULL,
          "vehicleType" TEXT NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      // Create migrations table
      const createMigrationsTableSQL = `
        CREATE TABLE IF NOT EXISTS "migrations" (
          "id" SERIAL PRIMARY KEY,
          "name" TEXT NOT NULL UNIQUE,
          "applied_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `;
      
      // Execute SQL in sequence
      console.log('Creating enums...');
      const { error: enumsError } = await supabase.rpc('exec', { query: createEnumsSQL });
      if (enumsError) {
        console.error('Error creating enums:', enumsError);
        return false;
      }
      
      console.log('Creating tables...');
      const { error: tablesError } = await supabase.rpc('exec', { query: createTablesSQL });
      if (tablesError) {
        console.error('Error creating tables:', tablesError);
        return false;
      }
      
      console.log('Creating migrations table...');
      const { error: migrationsTableError } = await supabase.rpc('exec', { query: createMigrationsTableSQL });
      if (migrationsTableError) {
        console.error('Error creating migrations table:', migrationsTableError);
        return false;
      }
      
      console.log('Initial schema created successfully');
      return true;
    } else {
      console.log('Schema already exists, proceeding with migrations');
      return true;
    }
  } catch (err) {
    console.error('Error creating initial schema:', err);
    return false;
  }
}

async function runMigrations() {
  console.log('Starting Supabase migrations...');
  
  try {
    // Check connection
    const { data: connCheck, error: connError } = await supabase.from('users').select('count').limit(1);
    
    if (connError && connError.code !== '42P01') { // If error is not "table doesn't exist"
      console.error('Error connecting to Supabase:', connError.message);
      process.exit(1);
    }
    
    console.log('Connected to Supabase successfully');

    // Create initial schema if needed
    const schemaCreated = await createInitialSchema();
    if (!schemaCreated) {
      console.error('Failed to create initial schema');
      process.exit(1);
    }

    // Load migration SQL files
    const migrationsDir = path.join(__dirname, '../migrations');
    
    if (!fs.existsSync(migrationsDir)) {
      console.log('Creating migrations directory...');
      fs.mkdirSync(migrationsDir, { recursive: true });
    }
    
    // Read and sort migration files
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Natural sort
    
    if (migrationFiles.length === 0) {
      console.log('No migration files found in the migrations directory.');
      console.log('Initial schema is set up, no additional migrations to apply.');
      process.exit(0);
    }
    
    console.log(`Found ${migrationFiles.length} migration files to apply`);
    
    // Get already applied migrations
    const { data: appliedMigrations, error: migrationsError } = await supabase
      .from('migrations')
      .select('name, applied_at');
    
    if (migrationsError && migrationsError.code !== '42P01') { // If error is not "table doesn't exist"
      console.error('Error checking applied migrations:', migrationsError.message);
      process.exit(1);
    }
    
    const appliedMigrationNames = new Set((appliedMigrations || []).map(m => m.name));
    
    // Apply migrations
    for (const migrationFile of migrationFiles) {
      if (appliedMigrationNames.has(migrationFile)) {
        console.log(`Migration ${migrationFile} already applied, skipping`);
        continue;
      }
      
      const migrationPath = path.join(migrationsDir, migrationFile);
      const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
      
      console.log(`Applying migration: ${migrationFile}`);
      
      try {
        // Execute the migration SQL
        const { error: migrationError } = await supabase.rpc('exec', { query: migrationSQL });
        
        if (migrationError) {
          console.error(`Error applying migration ${migrationFile}:`, migrationError.message);
          process.exit(1);
        }
        
        // Record the applied migration
        const { error: recordError } = await supabase
          .from('migrations')
          .insert({ name: migrationFile });
        
        if (recordError) {
          console.error(`Error recording migration ${migrationFile}:`, recordError.message);
          process.exit(1);
        }
        
        console.log(`Migration ${migrationFile} applied successfully`);
      } catch (err) {
        console.error(`Error applying migration ${migrationFile}:`, err.message);
        process.exit(1);
      }
    }
    
    console.log('✅ All migrations applied successfully!');
  } catch (err) {
    console.error('Error applying migrations:', err.message);
    process.exit(1);
  }
}

// Run the main function if this script is executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = runMigrations; 
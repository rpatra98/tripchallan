#!/usr/bin/env node

/**
 * Supabase Database Initialization Script
 * 
 * This script is used to initialize the Supabase database with:
 * 1. Schema migration
 * 2. SuperAdmin user creation
 * 
 * It replaces the old Neon/Prisma db:init and migrate scripts.
 */

const runMigrations = require('./supabase-migrate');
const seedSuperAdmin = require('./seed-superadmin');

async function initializeDatabase() {
  console.log('🔄 Starting Supabase database initialization...');
  
  try {
    // Run migrations first to create/update schema
    console.log('Running database migrations...');
    await runMigrations();
    
    // Then seed the SuperAdmin user
    console.log('Seeding SuperAdmin user...');
    const seedResult = await seedSuperAdmin();
    
    if (!seedResult.success) {
      console.error('❌ SuperAdmin creation failed:', seedResult.error);
      process.exit(1);
    }
    
    console.log('✅ Database initialization completed successfully');
    console.log('🚀 You can now start your application');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Run the initialization if this script is executed directly
if (require.main === module) {
  initializeDatabase();
}

module.exports = initializeDatabase; 
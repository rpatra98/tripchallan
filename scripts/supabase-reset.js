const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const runMigrations = require('./supabase-migrate');
const seedSuperAdmin = require('./seed-superadmin');

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

// List of tables to wipe in correct order to avoid foreign key conflicts
const tablesToWipe = [
  'activity_logs',          // Delete logs first as they reference many tables
  'coin_transactions',      // Delete transactions as they reference users
  'operator_permissions',   // Delete permissions as they reference users
  'seals',                  // Delete seals as they reference sessions
  'comments',               // Delete comments as they reference sessions and users
  'sessions',               // Delete sessions as they reference companies and users
  'vehicles',               // Delete vehicles as they reference companies and users
  'users',                  // Delete users next
  'companies',              // Delete companies last
  'migrations'              // Delete migrations tracking so they are reapplied
];

// Function to wipe all data from the database
async function wipeDatabase() {
  console.log('⚠️ Starting database wipe operation...');
  
  try {
    // Check database connection first
    const { data: connectionTest, error: connectionError } = await supabase.from('users').select('count').limit(1);
    if (connectionError && connectionError.code !== '42P01') { // If error is not "table doesn't exist"
      console.error('❌ Database connection failed:', connectionError);
      return false;
    }
    console.log('✅ Database connection successful');
    
    // First get a list of all tables to check if they exist
    console.log('Checking for existing tables...');
    const existingTables = [];
    
    for (const table of tablesToWipe) {
      const { error } = await supabase.from(table).select('count').limit(1);
      if (!error || error.code !== '42P01') { // 42P01 is the error code for table not found
        existingTables.push(table);
        console.log(`Table found: ${table}`);
      }
    }
    
    // Wipe each table that exists
    for (const table of existingTables) {
      console.log(`Deleting all data from table: ${table}`);
      try {
        const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        if (error) {
          console.error(`Error wiping table ${table}:`, error);
        } else {
          console.log(`Successfully wiped table: ${table}`);
        }
      } catch (tableError) {
        console.error(`Error processing table ${table}:`, tableError);
      }
    }
    
    console.log('Database wipe completed successfully');
    return true;
  } catch (error) {
    console.error('Database wipe failed:', error);
    return false;
  }
}

// Main function to run the wipe, migrate, and seed processes
async function resetDatabase() {
  try {
    console.log('🔄 Starting Supabase database reset process...');
    
    // First wipe the database
    const wipeSuccess = await wipeDatabase();
    if (!wipeSuccess) {
      console.error('⚠️ Database wipe failed, continuing with migration operation anyway');
    }
    
    // Run migrations to recreate the schema
    console.log('Running migrations to recreate schema...');
    try {
      await runMigrations();
    } catch (migrationError) {
      console.error('❌ Migration failed:', migrationError);
      process.exit(1);
    }
    
    // Seed the SuperAdmin user
    console.log('Seeding SuperAdmin user...');
    const seedResult = await seedSuperAdmin();
    if (!seedResult.success) {
      console.error('❌ SuperAdmin creation failed');
      process.exit(1);
    }
    
    console.log('✅ Database reset and seed completed successfully');
    console.log('🚀 You can now start the development server with: npm run dev');
    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error during reset operation:', error);
    process.exit(1);
  }
}

// Run the database reset operation
if (require.main === module) {
  resetDatabase();
}

module.exports = resetDatabase; 
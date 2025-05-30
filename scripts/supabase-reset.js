const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const bcrypt = require('bcrypt');
const { exec } = require('child_process');

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
  'companies'               // Delete companies last
];

// Function to wipe all data from the database
async function wipeDatabase() {
  console.log('⚠️ Starting database wipe operation...');
  
  try {
    // Check database connection first
    const { data: connectionTest, error: connectionError } = await supabase.from('users').select('count').limit(1);
    if (connectionError) {
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
      } else {
        console.log(`Table not found: ${table} (will be skipped)`);
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

// Function to create the SuperAdmin user directly
async function createSuperAdmin() {
  console.log('Creating SuperAdmin user...');
  
  try {
    // First check if SuperAdmin already exists
    const { data: existingSuperAdmin, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'superadmin@cbums.com')
      .limit(1);
    
    // Delete existing SuperAdmin if it exists
    if (!findError && existingSuperAdmin && existingSuperAdmin.length > 0) {
      console.log('Existing SuperAdmin found, deleting...');
      await supabase.from('users').delete().eq('email', 'superadmin@cbums.com');
    }
    
    // Hash the password
    const hashedPassword = await bcrypt.hash('superadmin123', 12);
    
    // Create the SuperAdmin user
    const { data, error } = await supabase
      .from('users')
      .insert({
        name: 'Super Admin',
        email: 'superadmin@cbums.com',
        password: hashedPassword,
        role: 'SUPERADMIN',
        coins: 1000000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating SuperAdmin:', error);
      return false;
    }
    
    console.log('SuperAdmin created successfully with ID:', data.id);
    return true;
  } catch (error) {
    console.error('Error creating SuperAdmin:', error);
    return false;
  }
}

// Main function to run the wipe and seed
async function resetAndStartApp() {
  try {
    console.log('🔄 Starting Supabase database reset process...');
    
    // First wipe the database
    const wipeSuccess = await wipeDatabase();
    if (!wipeSuccess) {
      console.error('Database wipe failed, continuing with seed operation anyway');
    }
    
    // Then create the SuperAdmin
    const createSuccess = await createSuperAdmin();
    if (!createSuccess) {
      console.error('SuperAdmin creation failed');
      process.exit(1);
    }
    
    console.log('✅ Database reset and seed completed successfully');
    
    // Start the development server
    console.log('🚀 Starting development server...');
    exec('npm run dev', (err, stdout, stderr) => {
      if (err) {
        console.error('Error starting development server:', err);
        return;
      }
      console.log(stdout);
    });
  } catch (error) {
    console.error('Fatal error during reset operation:', error);
    process.exit(1);
  }
}

// Run the reset and start operation
resetAndStartApp(); 
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const seedSuperAdmin = require('./seed-superadmin');
const bcrypt = require('bcrypt');

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
  'activity_logs',
  'employees',
  'users',
  'companies'
];

// Function to wipe all data from the database
async function wipeDatabase() {
  console.log('⚠️ Starting database wipe operation...');
  
  try {
    for (const table of tablesToWipe) {
      console.log(`Deleting all data from table: ${table}`);
      const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) {
        // If table doesn't exist, just log and continue
        if (error.code === '42P01') { // undefined_table
          console.log(`Table ${table} doesn't exist, skipping.`);
          continue;
        }
        console.error(`Error wiping table ${table}:`, error);
      } else {
        console.log(`Successfully wiped table: ${table}`);
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
    // Hash the password
    const hashedPassword = await bcrypt.hash('superadmin123', 12);
    
    // Create the SuperAdmin user
    const { data, error } = await supabase
      .from('users')
      .insert({
        id: '00000000-0000-0000-0000-000000000000', // Use a fixed ID for SuperAdmin
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
async function wipeAndSeed() {
  try {
    // First wipe the database
    const wipeSuccess = await wipeDatabase();
    if (!wipeSuccess) {
      console.error('Database wipe failed, aborting seed operation');
      process.exit(1);
    }
    
    // Then create the SuperAdmin
    const createSuccess = await createSuperAdmin();
    if (!createSuccess) {
      console.error('SuperAdmin creation failed');
      process.exit(1);
    }
    
    console.log('✅ Database wipe and seed completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Fatal error during wipe and seed operation:', error);
    process.exit(1);
  }
}

// Run the wipe and seed operation
wipeAndSeed(); 
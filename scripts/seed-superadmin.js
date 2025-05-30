const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function seedSuperAdmin() {
  try {
    console.log("🔄 Starting SuperAdmin seeding process...");

    // Check database connection first
    const { error: connectionError } = await supabase.from('users').select('count').limit(1);
    if (connectionError && connectionError.code !== '42P01') { // If error is not "table doesn't exist"
      console.error('❌ Database connection failed:', connectionError);
      return { success: false, error: connectionError };
    }

    // Check if SuperAdmin already exists
    console.log("Checking for existing SuperAdmin...");
    const { data: existingSuperAdmin, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'superadmin@cbums.com')
      .limit(1);

    // If SuperAdmin exists, we'll delete and recreate it
    if (!findError && existingSuperAdmin && existingSuperAdmin.length > 0) {
      console.log("SuperAdmin exists with ID:", existingSuperAdmin[0].id);
      console.log("Deleting existing SuperAdmin to create a fresh one...");
      
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('email', 'superadmin@cbums.com');
        
      if (deleteError) {
        console.error("Error deleting existing SuperAdmin:", deleteError);
        // Continue anyway, the insert might still work
      }
    }

    // Create SuperAdmin
    console.log("Creating new SuperAdmin...");
    const hashedPassword = await bcrypt.hash('superadmin123', 12);
    
    const { data: newSuperAdmin, error: createError } = await supabase
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

    if (createError) {
      console.error("❌ Error creating SuperAdmin:", createError);
      return { success: false, error: createError };
    }

    console.log("✅ Successfully created SuperAdmin with ID:", newSuperAdmin.id);
    return { success: true, id: newSuperAdmin.id };
  } catch (error) {
    console.error("❌ Error seeding SuperAdmin:", error);
    return { success: false, error };
  }
}

// Run the function if script is called directly
if (require.main === module) {
  seedSuperAdmin()
    .then(result => {
      if (result.success) {
        console.log("✅ SuperAdmin seed completed successfully");
        process.exit(0);
      } else {
        console.error("❌ SuperAdmin seed failed");
        process.exit(1);
      }
    })
    .catch(error => {
      console.error("❌ Fatal error seeding SuperAdmin:", error);
      process.exit(1);
    });
}

module.exports = seedSuperAdmin; 
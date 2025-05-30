const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseKey);

async function seedSuperAdmin() {
  try {
    console.log("Starting SuperAdmin seeding process...");

    // Check if SuperAdmin already exists
    console.log("Checking for existing SuperAdmin...");
    const { data: existingSuperAdmin, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'superadmin@cbums.com')
      .single();

    // If SuperAdmin exists, we're done
    if (!findError && existingSuperAdmin) {
      console.log("SuperAdmin already exists with ID:", existingSuperAdmin.id);
      return { success: true, id: existingSuperAdmin.id };
    }

    // SuperAdmin doesn't exist, create one
    console.log("No SuperAdmin found, creating new one...");
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
      console.error("Error creating SuperAdmin:", createError);
      return { success: false, error: createError };
    }

    console.log("Successfully created SuperAdmin with ID:", newSuperAdmin.id);
    return { success: true, id: newSuperAdmin.id };
  } catch (error) {
    console.error("Error seeding SuperAdmin:", error);
    return { success: false, error };
  }
}

// Run the function if script is called directly
if (require.main === module) {
  seedSuperAdmin()
    .then(result => {
      console.log("SuperAdmin seed result:", result);
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error("Fatal error seeding SuperAdmin:", error);
      process.exit(1);
    });
}

module.exports = seedSuperAdmin; 
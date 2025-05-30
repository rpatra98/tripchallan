const { createClient } = require('@supabase/supabase-js');
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

// Create Supabase client with service role key (required for schema management)
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

async function fixPermissions() {
  try {
    console.log("Starting permission fixes for Supabase...");

    // Fix schema permissions
    const fixSchemaQuery = `
      -- Grant USAGE privilege on schema public to anon, authenticated and service_role
      GRANT USAGE ON SCHEMA public TO anon;
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT USAGE ON SCHEMA public TO service_role;
      
      -- Grant permissions on all tables in the public schema
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
      GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
      
      -- Grant permissions for future tables
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
      
      -- Grant execute privileges on functions
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
      
      -- Grant default execute privileges for future functions
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO authenticated;
      ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO service_role;
    `;

    // Execute the SQL query to fix permissions
    const { error } = await supabase.rpc('exec_sql', { sql: fixSchemaQuery });

    if (error) {
      // If rpc fails (which it might due to permission issues), try using the SQL editor
      console.error("RPC method failed, this is expected:", error.message);
      console.log("Please run the following SQL in your Supabase SQL Editor:");
      console.log(fixSchemaQuery);
      console.log("\nAlternatively, you can use the Supabase dashboard to configure these permissions.");
      
      // Exit with information, not as an error
      console.log("\nPermission script completed with instructions for manual steps.");
      return;
    }

    console.log("Successfully fixed permissions for Supabase schema and objects!");
  } catch (error) {
    console.error("Error fixing permissions:", error);
    process.exit(1);
  }
}

// Run the permission fix function
fixPermissions(); 
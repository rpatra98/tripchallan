import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Ensure the environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
} else {
  console.log('Supabase URL configured:', supabaseUrl);
  // Log partial key for debugging (never log the full key)
  console.log('Supabase key configured (first 10 chars):', supabaseAnonKey.substring(0, 10) + '...');
}

// Type safety with the Database interface
export const supabase = createClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      // No autoRefreshToken for server-side usage
      autoRefreshToken: typeof window !== 'undefined',
    },
    db: {
      schema: 'public',
    },
  }
);

// Add helper method to test connection
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    console.log('Supabase connection test successful');
    return true;
  } catch (e) {
    console.error('Supabase connection test exception:', e);
    return false;
  }
};

export default supabase; 
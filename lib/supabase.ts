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
    global: {
      headers: {
        'x-application-name': 'cbums',
      },
    }
  }
);

// Add helper method to test connection with retry logic
export const testSupabaseConnection = async (retries = 3): Promise<boolean> => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Testing Supabase connection, attempt ${attempt}/${retries}`);
      const { data, error } = await supabase.from('users').select('count').limit(1);
      
      if (error) {
        console.error(`Supabase connection test failed (attempt ${attempt}/${retries}):`, error);
        
        if (attempt < retries) {
          // Exponential backoff with jitter
          const delay = Math.min(Math.pow(2, attempt) * 200 + Math.random() * 200, 2000);
          console.log(`Retrying in ${Math.round(delay)}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        return false;
      }
      
      console.log('Supabase connection test successful');
      return true;
    } catch (e) {
      console.error(`Supabase connection test exception (attempt ${attempt}/${retries}):`, e);
      
      if (attempt < retries) {
        // Exponential backoff with jitter for exceptions
        const delay = Math.min(Math.pow(2, attempt) * 300 + Math.random() * 300, 3000);
        console.log(`Retrying in ${Math.round(delay)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      return false;
    }
  }
  
  return false;
};

export default supabase; 
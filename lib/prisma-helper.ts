import { createClient } from '@supabase/supabase-js';

// Set up Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// Track connection state
let hasDisconnectedOnce = false;
let lastReconnectTime = 0;

/**
 * Execute a Supabase query with automatic retry on connection errors
 * @param operation Function that performs the Supabase operation
 * @returns Result of the operation
 */
export async function executePrismaWithRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    // If we've had connection issues before or it's been more than 30 seconds since reconnect,
    // reset the connection proactively
    const currentTime = Date.now();
    const reconnectInterval = 30 * 1000; // 30 seconds
    
    if (hasDisconnectedOnce || (currentTime - lastReconnectTime > reconnectInterval)) {
      await resetConnection();
      lastReconnectTime = currentTime;
    }
    
    return await operation();
  } catch (error: any) {
    // Check if this is a connection error
    if (
      error.message && 
      (error.message.includes('connection') || 
       error.code === 'ECONNREFUSED')
    ) {
      console.warn('Connection error detected, retrying with delay');
      hasDisconnectedOnce = true;
      
      // Try to wait and retry
      try {
        await resetConnection();
        
        // Try once more
        return await operation();
      } catch (retryError: any) {
        // If we still get a connection error, try one more time with longer delay
        if (
          retryError.message && 
          (retryError.message.includes('connection') || 
           retryError.code === 'ECONNREFUSED')
        ) {
          console.warn('Still getting connection error, trying final reconnect');
          
          try {
            await resetConnection(2000); // Longer wait on second retry
            return await operation();
          } catch (finalError) {
            console.error('Error on final retry:', finalError);
            throw finalError;
          }
        }
        
        console.error('Error on retry after connection issue:', retryError);
        throw retryError;
      }
    }
    
    // If it's not a connection error, just rethrow
    throw error;
  }
}

/**
 * Safely finds a company by ID with retry logic for connection errors
 */
export async function findCompanyById(id: string, includeEmployees = true) {
  return executePrismaWithRetry(async () => {
    const selectQuery = includeEmployees 
      ? `*, employees:users(id, name, email, role, subrole, coins)`
      : '*';
    
    const { data: company, error } = await supabase
      .from('companies')
      .select(selectQuery)
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error finding company by ID:', error);
      return null;
    }
    
    return company;
  });
}

/**
 * Safely finds a user by ID with retry logic for connection errors
 */
export async function findUserById(id: string) {
  return executePrismaWithRetry(async () => {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) {
      console.error('Error finding user by ID:', error);
      return null;
    }
    
    return user;
  });
}

/**
 * Safely finds users with specific criteria and retry logic for connection errors
 */
export async function findUsers(criteria: any) {
  return executePrismaWithRetry(async () => {
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .match(criteria);
    
    if (error) {
      console.error('Error finding users:', error);
      return [];
    }
    
    return users;
  });
}

/**
 * Safely finds first user with specific criteria and retry logic for connection errors
 */
export async function findFirstUser(criteria: any, select?: any) {
  return executePrismaWithRetry(async () => {
    const selectClause = select ? select.join(', ') : '*';
    
    const { data: user, error } = await supabase
      .from('users')
      .select(selectClause)
      .match(criteria)
      .limit(1)
      .single();
    
    if (error && !error.message?.includes('No rows found')) {
      console.error('Error finding first user:', error);
      return null;
    }
    
    return user;
  });
}

/**
 * Waits to allow connection issues to resolve
 * @param delayMs Optional delay (in milliseconds)
 */
export async function resetConnection(delayMs = 1000) {
  console.log(`Resetting connection with ${delayMs}ms delay`);
  try {
    // Wait for the specified delay
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    console.log('Connection reset successful');
  } catch (error) {
    console.error('Error resetting connection:', error);
    // If reconnection fails, we need to ensure we still attempt to reconnect next time
    hasDisconnectedOnce = true;
  }
}

export default {
  executePrismaWithRetry,
  findCompanyById,
  findUserById,
  findUsers,
  findFirstUser,
  resetConnection
}; 
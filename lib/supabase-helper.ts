import supabase from './supabase';
import { createClient } from '@supabase/supabase-js';
import { UserRole } from '@/prisma/enums';

/**
 * Generic function to execute Supabase queries with error handling
 */
export async function executeSupabaseQuery<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error('Supabase query error:', error);
    throw error;
  }
}

/**
 * Find company by ID
 */
export async function findCompanyById(id: string, includeEmployees = true) {
  return executeSupabaseQuery(async () => {
    // Basic company query
    let query = supabase
      .from('companies')
      .select('*')
      .eq('id', id)
      .single();
    
    // Get the company
    const { data: company, error } = await query;
    
    if (error) throw error;
    if (!company) return null;
    
    // If employees are requested, fetch them in a separate query
    if (includeEmployees) {
      const { data: employees, error: employeesError } = await supabase
        .from('users')
        .select('id, name, email, role, subrole, coins')
        .eq('companyId', id);
      
      if (employeesError) throw employeesError;
      
      // Add employees to company object
      return {
        ...company,
        employees: employees || []
      };
    }
    
    return company;
  });
}

/**
 * Find user by ID
 */
export async function findUserById(id: string) {
  return executeSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  });
}

/**
 * Find users by criteria
 */
export async function findUsers(criteria: any, select?: string) {
  return executeSupabaseQuery(async () => {
    // Start building the query
    let query = supabase.from('users').select(select || '*');
    
    // Apply criteria if provided
    if (criteria) {
      // For each key in criteria, add an eq filter
      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.eq(key, value);
        }
      });
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data || [];
  });
}

/**
 * Find first user by criteria
 */
export async function findFirstUser(criteria: any, select?: string) {
  return executeSupabaseQuery(async () => {
    // Start building the query
    let query = supabase.from('users').select(select || '*');
    
    // Apply criteria if provided
    if (criteria) {
      // For each key in criteria, add an eq filter
      Object.entries(criteria).forEach(([key, value]) => {
        if (value !== undefined) {
          query = query.eq(key, value);
        }
      });
    }
    
    // Limit to 1 result
    query = query.limit(1);
    
    const { data, error } = await query;
    
    if (error) throw error;
    return data && data.length > 0 ? data[0] : null;
  });
}

// Function to get a user by email
export const getUserByEmail = async (email: string) => {
  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      company:companies(*)
    `)
    .eq('email', email)
    .single();

  if (error) {
    console.error('Error fetching user by email:', error);
    return null;
  }

  return data;
};

// Function to get a user by ID
export const getUserById = async (id: string) => {
  const { data, error } = await supabase
    .from('users')
    .select(`
      *,
      company:companies(*)
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching user by ID:', error);
    return null;
  }

  return data;
};

// Function to create a new user
export const createUser = async (userData: any) => {
  const { data, error } = await supabase
    .from('users')
    .insert([userData])
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    throw error;
  }

  return data;
};

// Function to update a user
export const updateUser = async (id: string, userData: any) => {
  const { data, error } = await supabase
    .from('users')
    .update(userData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating user:', error);
    throw error;
  }

  return data;
};

// Function to delete a user
export const deleteUser = async (id: string) => {
  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting user:', error);
    throw error;
  }

  return true;
};

// Function to update user coins
export const updateUserCoins = async (userId: string, amount: number) => {
  // First get current coins
  const { data: user, error: fetchError } = await supabase
    .from('users')
    .select('coins')
    .eq('id', userId)
    .single();

  if (fetchError) {
    console.error('Error fetching user coins:', fetchError);
    throw fetchError;
  }

  // Calculate new coin balance
  const newBalance = (user?.coins || 0) + amount;
  
  // Update with new balance
  const { data, error } = await supabase
    .from('users')
    .update({ coins: newBalance })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('Error updating user coins:', error);
    throw error;
  }

  return data;
};

// Safely convert ID to string if it exists
export const safeId = (id: any): string | null => {
  if (!id) return null;
  return String(id);
};

// Get company users
export const getCompanyUsers = async (companyId: string) => {
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('companyId', companyId)
    .eq('role', UserRole.EMPLOYEE);

  if (error) {
    console.error('Error fetching company users:', error);
    return [];
  }

  return data || [];
};

// Check if database is accessible
export const checkDatabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('users').select('count').limit(1);
    if (error) return false;
    return true;
  } catch (e) {
    return false;
  }
};

export default {
  executeSupabaseQuery,
  findCompanyById,
  findUserById,
  findUsers,
  findFirstUser,
  getUserByEmail,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateUserCoins,
  safeId,
  getCompanyUsers,
  checkDatabaseConnection
}; 
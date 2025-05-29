import supabase from './supabase';

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

export default {
  executeSupabaseQuery,
  findCompanyById,
  findUserById,
  findUsers,
  findFirstUser
}; 
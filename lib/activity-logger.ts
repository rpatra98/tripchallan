import { ActivityAction } from '@/lib/enums';
import supabase from './supabase';
import supabaseAdmin from './supabase-admin';

interface ActivityLogData {
  userId: string;
  action: ActivityAction;
  details?: any;
  targetResourceId?: string;
  targetResourceType?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Add an activity log entry to the database using Supabase
 */
export async function addActivityLog(data: ActivityLogData) {
  try {
    // Use the admin client for writing logs to ensure we have proper permissions
    const { error } = await supabaseAdmin
      .from('activity_logs')
      .insert({
        user_id: data.userId,
        action: data.action,
        details: data.details || null,
        target_resource_id: data.targetResourceId || null,
        target_resource_type: data.targetResourceType || null,
        ip_address: data.ipAddress || null,
        user_agent: data.userAgent || null,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (error) {
    // Log error but don't throw to avoid breaking the main flow
    console.error('Error logging activity:', error);
  }
}

/**
 * Get activity logs with filtering options
 */
export async function getActivityLogs({
  userId,
  action,
  limit = 100,
  offset = 0,
  startDate,
  endDate,
  targetResourceType
}: {
  userId?: string;
  action?: ActivityAction;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  targetResourceType?: string;
}) {
  try {
    // Reading logs can be done with the regular client
    let query = supabase
      .from('activity_logs')
      .select(`
        *,
        user:users!activity_logs_user_id_fkey(id, name, email, role)
      `)
      .order('created_at', { ascending: false });
    
    // Apply filters
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    if (action) {
      query = query.eq('action', action);
    }
    
    if (targetResourceType) {
      query = query.eq('target_resource_type', targetResourceType);
    }
    
    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }
    
    // Apply pagination
    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Failed to fetch activity logs:', error);
      return { logs: [], count: 0 };
    }
    
    return { logs: data || [], count: count || 0 };
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return { logs: [], count: 0 };
  }
} 
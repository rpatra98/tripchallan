import { ActivityAction } from '@/prisma/enums';
import supabase from './supabase';

interface ActivityLogData {
  userId: string;
  action: ActivityAction;
  details?: any;
  targetResourceId?: string;
  targetResourceType?: string;
}

/**
 * Add an activity log entry to the database using Supabase
 */
export async function addActivityLog(data: ActivityLogData) {
  try {
    const { error } = await supabase
      .from('activity_logs')
      .insert({
        userId: data.userId,
        action: data.action,
        details: data.details || null,
        targetResourceId: data.targetResourceId || null,
        targetResourceType: data.targetResourceType || null,
        createdAt: new Date().toISOString()
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
    let query = supabase
      .from('activity_logs')
      .select(`
        *,
        user:users(id, name, email, role)
      `)
      .order('createdAt', { ascending: false });
    
    // Apply filters
    if (userId) {
      query = query.eq('userId', userId);
    }
    
    if (action) {
      query = query.eq('action', action);
    }
    
    if (targetResourceType) {
      query = query.eq('targetResourceType', targetResourceType);
    }
    
    if (startDate) {
      query = query.gte('createdAt', startDate.toISOString());
    }
    
    if (endDate) {
      query = query.lte('createdAt', endDate.toISOString());
    }
    
    // Apply pagination
    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('createdAt', { ascending: false });
    
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
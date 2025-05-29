import supabase from "@/lib/supabase";
import { ActivityAction } from "@/prisma/enums";
import { executeSupabaseQuery } from "./supabase-helper";

type ActivityLogParams = {
  userId: string;
  action: ActivityAction;
  details?: Record<string, any>;
  targetUserId?: string;
  targetResourceId?: string;
  targetResourceType?: string;
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Adds an entry to the activity log
 */
export async function addActivityLog({
  userId,
  action,
  details = {},
  targetUserId,
  targetResourceId,
  targetResourceType,
  ipAddress,
  userAgent,
}: ActivityLogParams) {
  try {
    const { data, error } = await supabase
      .from('activity_logs')
      .insert({
        userId,
        action,
        details,
        targetUserId,
        targetResourceId,
        targetResourceType,
        ipAddress,
        userAgent,
        createdAt: new Date().toISOString()
      })
      .select()
      .single();
    
    if (error) {
      console.error("Failed to create activity log:", error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error("Failed to create activity log:", error);
    // We don't want to fail the main operation if logging fails
    return null;
  }
}

/**
 * Wraps a database operation with activity logging
 * @param operation The database operation to perform
 * @param logParams Parameters for the activity log
 * @returns The result of the database operation
 */
export async function withActivityLog<T>(
  operation: () => Promise<T>,
  logParams: ActivityLogParams
): Promise<T> {
  try {
    // Perform the database operation
    const result = await operation();
    
    // Log the activity (don't await to avoid blocking)
    addActivityLog(logParams).catch(error => {
      console.error("Failed to log activity:", error);
    });
    
    return result;
  } catch (error) {
    // If the operation fails, we still want to propagate the error
    throw error;
  }
}

/**
 * Gets activity logs with flexible filtering
 */
export async function getActivityLogs({
  userId,
  userIds,
  action,
  fromDate,
  toDate,
  targetUserId,
  targetResourceId,
  targetResourceType,
  page = 1,
  limit = 20,
  customWhere,
  includeAuthActivities = true,
}: {
  userId?: string;
  userIds?: string[];
  action?: ActivityAction;
  fromDate?: Date;
  toDate?: Date;
  targetUserId?: string;
  targetResourceId?: string;
  targetResourceType?: string;
  page?: number;
  limit?: number;
  customWhere?: any;
  includeAuthActivities?: boolean;
}) {
  try {
    const skip = (page - 1) * limit;
    
    // Start with a basic query
    let query = supabase
      .from('activity_logs')
      .select(`
        *,
        user:users!userId(id, name, email, role),
        targetUser:users!targetUserId(id, name, email, role)
      `)
      .order('createdAt', { ascending: false })
      .range(skip, skip + limit - 1);
    
    // Apply filters
    if (userId) {
      query = query.eq('userId', userId);
    } else if (userIds && userIds.length > 0) {
      query = query.in('userId', userIds);
    }
    
    if (action) {
      query = query.eq('action', action);
    } else if (!includeAuthActivities) {
      query = query.not('action', 'in', `(${ActivityAction.LOGIN},${ActivityAction.LOGOUT})`);
    }
    
    if (targetUserId) {
      query = query.eq('targetUserId', targetUserId);
    }
    
    if (targetResourceId) {
      query = query.eq('targetResourceId', targetResourceId);
    }
    
    if (targetResourceType) {
      query = query.eq('targetResourceType', targetResourceType);
    }
    
    if (fromDate) {
      query = query.gte('createdAt', fromDate.toISOString());
    }
    
    if (toDate) {
      query = query.lte('createdAt', toDate.toISOString());
    }
    
    // Note: customWhere is not directly supported in Supabase
    // This would need a more complex implementation or stored procedures
    
    // Execute the query to get logs
    const { data: logs, error } = await query;
    
    if (error) {
      console.error("Error fetching activity logs:", error);
      throw error;
    }
    
    // Count query for pagination
    let countQuery = supabase
      .from('activity_logs')
      .select('count');
    
    // Apply the same filters to the count query
    if (userId) {
      countQuery = countQuery.eq('userId', userId);
    } else if (userIds && userIds.length > 0) {
      countQuery = countQuery.in('userId', userIds);
    }
    
    if (action) {
      countQuery = countQuery.eq('action', action);
    } else if (!includeAuthActivities) {
      countQuery = countQuery.not('action', 'in', `(${ActivityAction.LOGIN},${ActivityAction.LOGOUT})`);
    }
    
    if (targetUserId) {
      countQuery = countQuery.eq('targetUserId', targetUserId);
    }
    
    if (targetResourceId) {
      countQuery = countQuery.eq('targetResourceId', targetResourceId);
    }
    
    if (targetResourceType) {
      countQuery = countQuery.eq('targetResourceType', targetResourceType);
    }
    
    if (fromDate) {
      countQuery = countQuery.gte('createdAt', fromDate.toISOString());
    }
    
    if (toDate) {
      countQuery = countQuery.lte('createdAt', toDate.toISOString());
    }
    
    const { data: countData, error: countError } = await countQuery;
    
    if (countError) {
      console.error("Error counting activity logs:", countError);
      throw countError;
    }
    
    const totalCount = countData?.[0]?.count || 0;
    const totalPages = Math.ceil(totalCount / limit);
    
    // Debug logs for visibility
    console.log(`Found ${logs?.length || 0} logs, total count: ${totalCount}`);
    
    return {
      logs: logs || [],
      meta: {
        currentPage: page,
        totalPages,
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    };
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    
    // Return empty result rather than failing
    return {
      logs: [],
      meta: {
        currentPage: page,
        totalPages: 0,
        totalItems: 0,
        itemsPerPage: limit,
        hasNextPage: false,
        hasPrevPage: false,
      },
    };
  }
} 
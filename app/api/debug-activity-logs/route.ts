import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { UserRole } from "@/lib/enums";
import { supabase } from "@/lib/supabase";

/**
 * Debug endpoint to directly fetch activity logs for testing
 * This bypasses all permission checks and only accessible to SUPERADMIN users
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== UserRole.SUPERADMIN) {
      return NextResponse.json({ error: "Unauthorized. Only SUPERADMIN can access this endpoint." }, { status: 401 });
    }
    
    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    
    // Direct database query without any filtering
    const skip = (page - 1) * limit;
    
    // Get logs with pagination
    const { data: logs, error: logsError } = await supabase
      .from('activityLogs')
      .select(`
        *,
        user:userId(id, name, email, role),
        targetUser:targetUserId(id, name, email, role)
      `)
      .order('createdAt', { ascending: false })
      .range(skip, skip + limit - 1);
    
    if (logsError) {
      console.error('Error fetching activity logs:', logsError);
      return NextResponse.json({ error: 'Failed to fetch activity logs' }, { status: 500 });
    }
    
    // Get total count
    const { count: totalCount, error: countError } = await supabase
      .from('activityLogs')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.error('Error counting activity logs:', countError);
    }
    
    console.log(`Debug activity logs endpoint: Found ${logs ? logs.length : 0} logs directly from database`);
    
    if (!logs || logs.length === 0) {
      // Try to determine if there are any logs at all in the database
      const { data: anyLogs, error: anyLogsError } = await supabase
        .from('activityLogs')
        .select('id')
        .limit(1);
      
      if (anyLogsError || !anyLogs || anyLogs.length === 0) {
        console.log("No activity logs found in the database at all");
      } else {
        console.log("Database has logs, but none matched the query criteria");
      }
    }
    
    // Return with the same structure as the main activity logs endpoint
    return NextResponse.json({
      logs: logs || [],
      meta: {
        currentPage: page,
        totalPages: Math.ceil((totalCount || 0) / limit),
        totalItems: totalCount || 0,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil((totalCount || 0) / limit),
        hasPrevPage: page > 1,
      }
    });
  } catch (error) {
    console.error("Error in debug activity logs endpoint:", error);
    return NextResponse.json(
      { error: "Failed to process debug activity logs request", details: String(error) },
      { status: 500 }
    );
  }
}
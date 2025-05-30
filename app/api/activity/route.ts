import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { UserRole, ActivityAction } from "@/lib/enums";
import { getActivityLogs } from "@/lib/activity-logger";

async function handler(req: NextRequest) {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const userId = url.searchParams.get('userId') || undefined;
    const action = url.searchParams.get('action') as ActivityAction | undefined;
    const targetResourceType = url.searchParams.get('targetResourceType') || undefined;
    
    const startDateStr = url.searchParams.get('startDate');
    const endDateStr = url.searchParams.get('endDate');
    
    // Convert date strings to Date objects if provided
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;
    
    // Get logs with filters
    const { logs, count } = await getActivityLogs({
      userId,
      action,
      limit,
      offset,
      startDate,
      endDate,
      targetResourceType
    });
    
    // Get unique resource types for filtering UI
    const resourceTypes = [...new Set(logs.map(log => log.target_resource_type).filter(Boolean))];
    const actions = [...new Set(logs.map(log => log.action).filter(Boolean))];
    
    return NextResponse.json({
      logs,
      resourceTypes,
      actions,
      pagination: {
        total: count,
        limit,
        offset
      }
    });
  } catch (error: unknown) {
    console.error("Error fetching activity logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity logs" },
      { status: 500 }
    );
  }
}

// Only SuperAdmin can view all activity logs
export const GET = withAuth(handler, [UserRole.SUPERADMIN]); 
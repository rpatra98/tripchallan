import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { UserRole, ActivityAction } from "@/prisma/enums";
import { getActivityLogs } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";
import { PrismaClient } from "@prisma/client";

// Define the ActivityLog type here to match what's returned from the database
type ActivityLog = {
  id: string;
  action: string;
  details: any;
  targetResourceType?: string;
  targetResourceId?: string;
  userId: string;
  createdAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  targetUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
};

async function handler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const userId = url.searchParams.get("userId") || undefined;
    const action = url.searchParams.get("action") || undefined;
    const targetResourceType = url.searchParams.get("targetResourceType") || undefined;
    const targetResourceId = url.searchParams.get("targetResourceId") || undefined;
    const deviceType = url.searchParams.get("deviceType") || undefined;
    
    // Parse date parameters if provided
    let fromDate: Date | undefined;
    let toDate: Date | undefined;
    
    if (url.searchParams.get("fromDate")) {
      fromDate = new Date(url.searchParams.get("fromDate")!);
    }
    
    if (url.searchParams.get("toDate")) {
      toDate = new Date(url.searchParams.get("toDate")!);
    }
    
    // Filter options based on user role
    const userIds: string[] = [];
    
    // SUPERADMIN can see activity for all users - no filtering needed
    if (session.user.role === UserRole.SUPERADMIN) {
      // If a specific userId filter was requested, use that
      if (userId) {
        userIds.push(userId);
      }
      // For SUPERADMIN, don't apply any userId filtering
      // No additional filtering needed - SUPERADMIN sees all activities
    }
    // ADMIN can see activity for users they created, so get those user IDs
    else if (session.user.role === UserRole.ADMIN) {
      if (userId) {
        // Check if this admin created the requested user
        const requestedUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { createdById: true, role: true }
        });
        
        if (requestedUser?.createdById === session.user.id) {
          userIds.push(userId);
        } else {
          // If they didn't create this user, they can't see their activity
          return NextResponse.json({
            logs: [],
            meta: {
              currentPage: page,
              totalPages: 0,
              totalItems: 0,
              itemsPerPage: limit,
              hasNextPage: false,
              hasPrevPage: false,
            }
          });
        }
      } else {
        // Get all users created by this admin (COMPANY and EMPLOYEE only)
        const createdUsers = await prisma.user.findMany({
          where: { 
            createdById: session.user.id,
            role: { in: [UserRole.COMPANY, UserRole.EMPLOYEE] }
          },
          select: { id: true }
        });
        
        // Add only IDs of COMPANY and EMPLOYEE users they created (exclude self)
        userIds.push(...createdUsers.map((user: { id: string }) => user.id));
      }
    }
    // COMPANY can see activity for their employees
    else if (session.user.role === UserRole.COMPANY) {
      if (userId) {
        // Check if this employee belongs to this company
        const employee = await prisma.user.findUnique({
          where: { 
            id: userId,
            role: UserRole.EMPLOYEE,
            companyId: session.user.companyId || undefined
          },
          select: { id: true }
        });
        
        if (employee) {
          userIds.push(userId);
        } else {
          // If this isn't their employee, they can only see their own non-login/logout activity
          return NextResponse.json({
            logs: [],
            meta: {
              currentPage: page,
              totalPages: 0,
              totalItems: 0,
              itemsPerPage: limit,
              hasNextPage: false,
              hasPrevPage: false,
            }
          });
        }
      } else {
        // Get all employees for this company
        const employees = await prisma.user.findMany({
          where: { 
            role: UserRole.EMPLOYEE,
            companyId: session.user.companyId || undefined
          },
          select: { id: true }
        });
        
        // Only add IDs of employees (not the company itself) for login/logout events
        // For other types of activities, we need to include the company's ID
        if (action === "LOGIN" || action === "LOGOUT") {
          userIds.push(...employees.map((emp: { id: string }) => emp.id));
        } else {
          // For non-login/logout activities, include the company's own ID too
          userIds.push(session.user.id, ...employees.map((emp: { id: string }) => emp.id));
        }
      }
    }
    // EMPLOYEE can only see their own activity (excluding login/logout)
    else {
      if (action === "LOGIN" || action === "LOGOUT") {
        // Employees can't see any login/logout activities
        // Return empty result
        return NextResponse.json({
          logs: [],
          meta: {
            currentPage: page,
            totalPages: 0,
            totalItems: 0,
            itemsPerPage: limit,
            hasNextPage: false,
            hasPrevPage: false,
          }
        });
      } else {
        // For other types of activities, employees can see their own
        userIds.push(session.user.id);
      }
    }
    
    // Get activity logs based on filtered user IDs
    let result: {
      logs: ActivityLog[];
      meta: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
      };
    };

    // Always fetch logs for SUPERADMIN, even if userIds array is empty
    if (userIds.length > 0 || session.user.role === UserRole.SUPERADMIN) {
      // Custom filtering for deviceType if provided
      let customWhere: any = undefined;
      
      if (deviceType && (deviceType === 'mobile' || deviceType === 'desktop')) {
        // We need a custom where clause for this because it's within JSON
        customWhere = {
          OR: [
            {
              // Check device type in details JSON field (for newer format)
              details: {
                path: ['device'],
                equals: deviceType
              }
            },
            {
              // For login/logout activity with specific device type
              AND: [
                {
                  action: {
                    in: ['LOGIN', 'LOGOUT']
                  }
                },
                {
                  // Filter by userAgent for legacy records
                  userAgent: deviceType === 'mobile' 
                    ? { contains: 'mobile|android|iphone|ipad|ipod|blackberry', mode: 'insensitive' }
                    : { not: { contains: 'mobile|android|iphone|ipad|ipod|blackberry' } }
                }
              ]
            }
          ]
        };
      }
      
      // Log the query parameters to debug
      console.log("Activity logs query parameters:", {
        userId: userIds.length === 1 ? userIds[0] : undefined,
        userIds: userIds.length > 1 ? userIds : undefined,
        action,
        fromDate,
        toDate,
        deviceType
      });
      
      // Create an exclusion filter - but NOT for SUPERADMIN users
      let excludeSelfLoginFilter = {};
      
      // Only apply self login exclusion for non-SUPERADMIN users
      if (session.user.role !== UserRole.SUPERADMIN) {
        excludeSelfLoginFilter = {
          NOT: {
            AND: [
              { userId: session.user.id },
              { action: { in: ['LOGIN', 'LOGOUT'] } }
            ]
          }
        };
      }
      
      // Merge the custom where clause with our self-exclusion filter
      if (customWhere) {
        customWhere = {
          AND: [
            customWhere,
            excludeSelfLoginFilter
          ]
        };
      } else {
        customWhere = excludeSelfLoginFilter;
      }
      
      result = await getActivityLogs({
        action: action as ActivityAction | undefined,
        fromDate,
        toDate,
        targetResourceId,
        targetResourceType,
        page,
        limit,
        // For SUPERADMIN, don't apply any user filtering - they see everything
        userId: session.user.role === UserRole.SUPERADMIN ? undefined : (userIds.length === 1 ? userIds[0] : undefined),
        // Only apply userIds filtering for non-SUPERADMIN roles
        userIds: session.user.role === UserRole.SUPERADMIN ? undefined : (userIds.length > 1 ? userIds : undefined),
        // For SUPERADMIN, only apply device type filtering if specified
        customWhere: session.user.role === UserRole.SUPERADMIN ? 
          (deviceType ? customWhere : undefined) : 
          customWhere,
        // CRITICAL: Always include auth activities by default
        includeAuthActivities: true
      });
    } else {
      // No visible users, return empty result
      result = {
        logs: [],
        meta: {
          currentPage: page,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: limit,
          hasNextPage: false,
          hasPrevPage: false,
        }
      };
    }
    
    // Debug log to help diagnose the issue
    if (result && result.logs) {
      console.log(`Returning ${result.logs.length} logs. Types:`, 
        [...new Set(result.logs.map((log: ActivityLog) => log.action))].join(', '));
      
      // Check specifically for login/logout activities
      const authActivities = result.logs.filter((log: ActivityLog) => 
        log.action === ActivityAction.LOGIN || log.action === ActivityAction.LOGOUT);
      console.log(`Auth activities in results: ${authActivities.length}`);
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching activity logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch activity logs" },
      { status: 500 }
    );
  }
}

// Allow only authenticated users
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
  UserRole.EMPLOYEE,
]); 
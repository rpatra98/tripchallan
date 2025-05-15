import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { UserRole, ActivityAction } from "@/prisma/enums";
import prisma from "@/lib/prisma";

/**
 * Debug endpoint to check if login/logout activities exist in the database
 */
async function handler() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== UserRole.SUPERADMIN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Check total count of activity logs
    const totalLogsCount = await prisma.activityLog.count();
    
    // Get sample of recent logs
    const recentLogs = await prisma.activityLog.findMany({
      take: 5,
      orderBy: {
        createdAt: "desc"
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        targetUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });

    // Get counts by action type
    const actionCounts = await Promise.all(
      Object.values(ActivityAction).map(async (action) => {
        const count = await prisma.activityLog.count({
          where: { action: action as ActivityAction }
        });
        return { action, count };
      })
    );
    
    // Return diagnostic info
    return NextResponse.json({
      totalLogsCount,
      recentLogs,
      actionCounts,
      message: totalLogsCount > 0 
        ? "Activity logs exist in the database" 
        : "No activity logs found in the database"
    });
  } catch (error) {
    console.error("Error checking activity logs:", error);
    return NextResponse.json(
      { error: "Failed to check activity logs", details: String(error) },
      { status: 500 }
    );
  }
}

// Allow all authenticated users during debugging
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
  UserRole.EMPLOYEE
]); 
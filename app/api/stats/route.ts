import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import { subDays } from 'date-fns';

async function handler() {
  try {
    const now = new Date();
    const lastWeek = subDays(now, 7);
    const lastMonth = subDays(now, 30);

    // Get total sessions count
    const totalSessions = await prisma.session.count();
    
    // Get sessions by status
    const sessionsByStatus = await prisma.session.groupBy({
      by: ['status'],
      _count: true
    });
    
    // Get sessions created in the last 7 days
    const recentSessions = await prisma.session.count({
      where: {
        createdAt: {
          gte: lastWeek
        }
      }
    });

    // Get session completion rate
    const completedSessions = sessionsByStatus.find((s: {status: string, _count: number}) => s.status === 'COMPLETED')?._count || 0;
    const completionRate = totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;
    
    // Get average session duration for completed sessions
    const sessionDurations = await prisma.$queryRaw`
      SELECT AVG(EXTRACT(EPOCH FROM ("updatedAt" - "createdAt"))) as avg_duration
      FROM "Session"
      WHERE status = 'COMPLETED'
    `;
    const avgSessionDuration = sessionDurations[0]?.avg_duration || 0;
    
    // Get total users count
    const totalUsers = await prisma.user.count();
    
    // Get users by role
    const usersByRole = await prisma.user.groupBy({
      by: ['role'],
      _count: true
    });
    
    // Get active users (users who have logged in within the last 7 days)
    const activeUsers = await prisma.activityLog.groupBy({
      by: ['userId'],
      where: {
        createdAt: {
          gte: lastWeek
        },
        action: 'LOGIN'
      }
    });
    
    // Get total companies count
    const totalCompanies = await prisma.user.count({
      where: {
        role: UserRole.COMPANY
      }
    });

    // Get active vs inactive companies
    const activeCompanies = await prisma.company.count({
      where: {
        isActive: true
      }
    });

    const inactiveCompanies = await prisma.company.count({
      where: {
        isActive: false
      }
    });
    
    // Get total seals count
    const totalSeals = await prisma.seal.count();
    
    // Get verified vs unverified seals
    const sealsByVerification = await prisma.seal.groupBy({
      by: ['verified'],
      _count: true
    });

    // Get total coins in the system
    const totalCoins = await prisma.user.aggregate({
      _sum: {
        coins: true,
      },
    });

    // Get recent activity (last 24 hours)
    const recentActivity = await prisma.activityLog.count({
      where: {
        createdAt: {
          gte: subDays(now, 1)
        }
      }
    });

    // Get activity trend (last 7 days by day)
    const activityTrend = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', "createdAt") as day,
        COUNT(*) as count
      FROM "ActivityLog"
      WHERE "createdAt" >= ${lastWeek}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY day ASC
    `;

    // Get error rate from activity logs
    const totalRequests = await prisma.activityLog.count({
      where: {
        createdAt: {
          gte: lastWeek
        }
      }
    });

    const errorRequests = await prisma.activityLog.count({
      where: {
        createdAt: {
          gte: lastWeek
        },
        details: {
          path: ['error'],
          not: null
        }
      }
    });

    const errorRate = totalRequests > 0 ? (errorRequests / totalRequests) * 100 : 0;

    return NextResponse.json({
      stats: {
        totalUsers,
        totalAdmins: usersByRole.find((u: {role: string, _count: number}) => u.role === UserRole.ADMIN)?._count || 0,
        totalCompanies,
        totalEmployees: usersByRole.find((u: {role: string, _count: number}) => u.role === UserRole.EMPLOYEE)?._count || 0,
        totalCoins: totalCoins._sum.coins || 0,
        totalSessions,
        totalSeals,
      },
      sessions: {
        total: totalSessions,
        byStatus: sessionsByStatus,
        recentSessions,
        completionRate: parseFloat(completionRate.toFixed(2)),
        avgDuration: parseFloat(avgSessionDuration.toFixed(2))
      },
      users: {
        total: totalUsers,
        byRole: usersByRole,
        activeUsers: activeUsers.length,
        activePercentage: parseFloat(((activeUsers.length / totalUsers) * 100).toFixed(2))
      },
      companies: {
        total: totalCompanies,
        active: activeCompanies,
        inactive: inactiveCompanies,
        activePercentage: parseFloat(((activeCompanies / (activeCompanies + inactiveCompanies)) * 100).toFixed(2))
      },
      seals: {
        total: totalSeals,
        byVerification: sealsByVerification,
        verifiedPercentage: parseFloat(((sealsByVerification.find((s: {verified: boolean, _count: number}) => s.verified === true)?._count || 0) / totalSeals * 100).toFixed(2))
      },
      system: {
        recentActivity,
        activityTrend,
        errorRate: parseFloat(errorRate.toFixed(2))
      }
    });
  } catch (error) {
    console.error("Error fetching stats:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}

// Only superadmins can access stats
export const GET = withAuth(handler, [UserRole.SUPERADMIN]); 
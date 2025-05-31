import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/lib/enums";
import { subDays } from 'date-fns';

async function handler() {
  try {
    const now = new Date();
    const lastWeek = subDays(now, 7);
    const lastMonth = subDays(now, 30);

    // Get total users by role with explicit counts
    const adminsCount = await supabase.from('users').count({
      where: { role: UserRole.ADMIN }
    });
    
    const superadminsCount = await supabase.from('users').count({
      where: { role: UserRole.SUPERADMIN }
    });
    
    const companiesCount = await supabase.from('users').count({
      where: { role: UserRole.COMPANY }
    });
    
    const employeesCount = await supabase.from('users').count({
      where: { role: UserRole.EMPLOYEE }
    });
    
    // Calculate total users
    const totalUsers = adminsCount + superadminsCount + companiesCount + employeesCount;
    
    // Get users by role
    const usersByRole = await supabase.from('users').groupBy({
      by: ['role'],
      _count: true
    });

    // Get total sessions count
    const totalSessions = await supabase.from('sessions').count();
    
    // Get sessions by status
    const sessionsByStatus = await supabase.from('sessions').groupBy({
      by: ['status'],
      _count: true
    });
    
    // Get sessions created in the last 7 days
    const recentSessions = await supabase.from('sessions').count({
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
    
    // Get active users (users who have logged in within the last 7 days)
    const activeUsers = await supabase.from('activity_logs').groupBy({
      by: ['userId'],
      where: {
        createdAt: {
          gte: lastWeek
        },
        action: 'LOGIN'
      }
    });
    
    // Get active vs inactive companies
    const activeCompanies = await supabase.from('companys').count({
      where: {
        isActive: true
      }
    });

    const inactiveCompanies = await supabase.from('companys').count({
      where: {
        isActive: false
      }
    });
    
    // Get total seals count
    const totalSeals = await supabase.from('seals').count();
    
    // Get verified vs unverified seals
    const sealsByVerification = await supabase.from('seals').groupBy({
      by: ['verified'],
      _count: true
    });

    // Get total coins in the system
    const totalCoins = await supabase.from('users').aggregate({
      _sum: {
        coins: true,
      },
    });

    // Get recent activity (last 24 hours)
    const recentActivity = await supabase.from('activity_logs').count({
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
    const totalRequests = await supabase.from('activity_logs').count({
      where: {
        createdAt: {
          gte: lastWeek
        }
      }
    });

    const errorRequests = await supabase.from('activity_logs').count({
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

    console.log("Stats data:", {
      totalUsers,
      adminsCount,
      companiesCount,
      employeesCount,
      totalCoins: totalCoins._sum.coins || 0
    });

    return NextResponse.json({
      stats: {
        totalUsers,
        totalAdmins: adminsCount,
        totalCompanies: companiesCount,
        totalEmployees: employeesCount,
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
        activePercentage: totalUsers > 0 ? parseFloat(((activeUsers.length / totalUsers) * 100).toFixed(2)) : 0
      },
      companies: {
        total: companiesCount,
        active: activeCompanies,
        inactive: inactiveCompanies,
        activePercentage: (activeCompanies + inactiveCompanies) > 0 ? 
          parseFloat(((activeCompanies / (activeCompanies + inactiveCompanies)) * 100).toFixed(2)) : 0
      },
      seals: {
        total: totalSeals,
        byVerification: sealsByVerification,
        verifiedPercentage: totalSeals > 0 ? 
          parseFloat(((sealsByVerification.find((s: {verified: boolean, _count: number}) => s.verified === true)?._count || 0) / totalSeals * 100).toFixed(2)) : 0
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
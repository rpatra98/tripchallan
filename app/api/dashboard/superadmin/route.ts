import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/lib/enums";

async function handler() {
  try {
    // Get recent sessions with status breakdown
    const sessions = await supabase.from('sessions').select('*').{
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        seal: true,
      },
    });

    // Get session status counts
    const pendingCount = await supabase.from('sessions').count({
      where: { status: "PENDING" },
    });

    const inProgressCount = await supabase.from('sessions').count({
      where: { status: "IN_PROGRESS" },
    });

    const completedCount = await supabase.from('sessions').count({
      where: { status: "COMPLETED" },
    });

    // Get total sessions count
    const totalSessions = await supabase.from('sessions').count();

    // Get coin transaction logs
    const coinTransactions = await supabase.from('coinTransactions').select('*').{
      take: 20,
      orderBy: { createdAt: "desc" },
      include: {
        fromUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
        toUser: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
    });

    // Get system stats - Use countAll() to ensure accurate counts
    const totalAdmins = await supabase.from('users').count({
      where: { role: UserRole.ADMIN },
    });

    const totalCompanies = await supabase.from('users').count({
      where: { role: UserRole.COMPANY },
    });

    const totalEmployees = await supabase.from('users').count({
      where: { role: UserRole.EMPLOYEE },
    });

    // Count SuperAdmins too
    const totalSuperAdmins = await supabase.from('users').count({
      where: { role: UserRole.SUPERADMIN },
    });

    // Calculate total users
    const totalUsers = totalAdmins + totalCompanies + totalEmployees + totalSuperAdmins;

    // Total coins in the system
    const totalCoins = await supabase.from('users').aggregate({
      _sum: {
        coins: true,
      },
    });

    return NextResponse.json({
      sessions: {
        recent: sessions,
        stats: {
          total: totalSessions,
          pending: pendingCount,
          inProgress: inProgressCount,
          completed: completedCount,
        },
      },
      coinFlow: {
        recent: coinTransactions,
        totalCoins: totalCoins._sum.coins || 0,
      },
      systemStats: {
        totalUsers,
        admins: totalAdmins,
        companies: totalCompanies,
        employees: totalEmployees,
        superadmins: totalSuperAdmins,
      },
    });
  } catch (error) {
    console.error("Error fetching superadmin dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

// Only SuperAdmin can access this dashboard
export const GET = withAuth(handler, [UserRole.SUPERADMIN]); 
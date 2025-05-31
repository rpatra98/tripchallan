import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/lib/enums";

async function handler() {
  try {
    // Get recent sessions with status breakdown
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select(`
        *,
        createdBy:createdById(id, name),
        company:companyId(id, name),
        seal:id(*)
      `)
      .order('createdAt', { ascending: false })
      .limit(10);
      
    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }

    // Get session status counts
    const { count: pendingCount, error: pendingError } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');
      
    if (pendingError) {
      console.error('Error counting pending sessions:', pendingError);
    }

    const { count: inProgressCount, error: inProgressError } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'IN_PROGRESS');
      
    if (inProgressError) {
      console.error('Error counting in-progress sessions:', inProgressError);
    }

    const { count: completedCount, error: completedError } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'COMPLETED');
      
    if (completedError) {
      console.error('Error counting completed sessions:', completedError);
    }

    // Get total sessions count
    const { count: totalSessions, error: totalError } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true });
      
    if (totalError) {
      console.error('Error counting total sessions:', totalError);
    }

    // Get coin transaction logs
    const { data: coinTransactions, error: transactionsError } = await supabase
      .from('coinTransactions')
      .select(`
        *,
        fromUser:fromUserId(id, name, role),
        toUser:toUserId(id, name, role)
      `)
      .order('createdAt', { ascending: false })
      .limit(20);
      
    if (transactionsError) {
      console.error('Error fetching coin transactions:', transactionsError);
    }

    // Get system stats
    const { count: totalAdmins, error: adminsError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', UserRole.ADMIN);
      
    if (adminsError) {
      console.error('Error counting admins:', adminsError);
    }

    const { count: totalCompanies, error: companiesError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', UserRole.COMPANY);
      
    if (companiesError) {
      console.error('Error counting companies:', companiesError);
    }

    const { count: totalEmployees, error: employeesError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', UserRole.EMPLOYEE);
      
    if (employeesError) {
      console.error('Error counting employees:', employeesError);
    }

    // Count SuperAdmins too
    const { count: totalSuperAdmins, error: superadminsError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', UserRole.SUPERADMIN);
      
    if (superadminsError) {
      console.error('Error counting superadmins:', superadminsError);
    }

    // Calculate total users
    const totalUsers = (totalAdmins || 0) + (totalCompanies || 0) + (totalEmployees || 0) + (totalSuperAdmins || 0);

    // Total coins in the system - get all users and sum their coins manually
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('coins');
      
    if (usersError) {
      console.error('Error fetching user coins:', usersError);
    }
    
    // Sum up coins manually
    const totalCoins = (allUsers || []).reduce((sum, user) => sum + (user.coins || 0), 0);

    return NextResponse.json({
      sessions: {
        recent: sessions || [],
        stats: {
          total: totalSessions || 0,
          pending: pendingCount || 0,
          inProgress: inProgressCount || 0,
          completed: completedCount || 0,
        },
      },
      coinFlow: {
        recent: coinTransactions || [],
        totalCoins: totalCoins || 0,
      },
      systemStats: {
        totalUsers,
        admins: totalAdmins || 0,
        companies: totalCompanies || 0,
        employees: totalEmployees || 0,
        superadmins: totalSuperAdmins || 0,
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
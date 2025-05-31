import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { SessionStatus, UserRole } from "@/lib/enums";

async function handler() {
  try {
    const session = await getServerSession(authOptions);
    const companyId = session?.user.id;

    // Get company details
    const { data: company, error: companyError } = await supabase
      .from('users')
      .select('id, name, email, coins, createdAt')
      .eq('id', companyId)
      .single();

    if (companyError) {
      console.error('Error fetching company:', companyError);
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Get employee count
    const { count: employeeCount, error: countError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('companyId', companyId)
      .eq('role', UserRole.EMPLOYEE);

    // Get sessions by status
    const { count: pendingSessions, error: pendingError } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('companyId', companyId)
      .eq('status', SessionStatus.PENDING);

    const { count: inProgressSessions, error: inProgressError } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('companyId', companyId)
      .eq('status', SessionStatus.IN_PROGRESS);

    const { count: completedSessions, error: completedError } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('companyId', companyId)
      .eq('status', SessionStatus.COMPLETED);

    // Get recent sessions
    const { data: recentSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*, createdBy:createdById(id, name, subrole), seal:id(*)') // Adjusted to get seals via a relation
      .eq('companyId', companyId)
      .order('createdAt', { ascending: false })
      .limit(10);
      
    if (sessionsError) {
      console.error('Error fetching recent sessions:', sessionsError);
    }

    // Get seal stats
    const { count: verifiedSealsCount, error: verifiedError } = await supabase
      .from('seals')
      .select('*', { count: 'exact', head: true })
      .eq('verified', true)
      .eq('sessionCompanyId', companyId); // Assuming there's a sessionCompanyId column

    const { count: unverifiedSealsCount, error: unverifiedError } = await supabase
      .from('seals')
      .select('*', { count: 'exact', head: true })
      .eq('verified', false)
      .eq('sessionCompanyId', companyId); // Assuming there's a sessionCompanyId column

    // Get recent comments on company's sessions
    const { data: recentComments, error: commentsError } = await supabase
      .from('comments')
      .select(`
        *,
        user:userId(id, name, role),
        session:sessionId(id, source, destination)
      `)
      .eq('sessionCompanyId', companyId) // Assuming there's a sessionCompanyId column or join
      .order('createdAt', { ascending: false })
      .limit(5);
      
    if (commentsError) {
      console.error('Error fetching recent comments:', commentsError);
    }

    // Get coin transactions
    const { data: coinTransactions, error: transactionsError } = await supabase
      .from('coinTransactions')
      .select('*')
      .or(`fromUserId.eq.${companyId},toUserId.eq.${companyId}`)
      .order('createdAt', { ascending: false })
      .limit(10);
      
    if (transactionsError) {
      console.error('Error fetching coin transactions:', transactionsError);
    }

    return NextResponse.json({
      company,
      employees: {
        count: employeeCount || 0,
      },
      sessions: {
        summary: {
          pending: pendingSessions || 0,
          inProgress: inProgressSessions || 0,
          completed: completedSessions || 0,
          total: (pendingSessions || 0) + (inProgressSessions || 0) + (completedSessions || 0),
        },
        recent: recentSessions || [],
      },
      seals: {
        verified: verifiedSealsCount || 0,
        unverified: unverifiedSealsCount || 0,
        total: (verifiedSealsCount || 0) + (unverifiedSealsCount || 0),
      },
      comments: recentComments || [],
      coins: {
        balance: company.coins || 0,
        recentTransactions: coinTransactions || [],
      },
    });
  } catch (error) {
    console.error("Error fetching company dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

// Only Company users can access this dashboard
export const GET = withAuth(handler, [UserRole.COMPANY]); 
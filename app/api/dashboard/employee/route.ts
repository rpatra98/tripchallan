import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { EmployeeSubrole, UserRole } from "@/lib/enums";

type DashboardData = {
  employee: {
    id: string;
    name: string;
    email: string;
    subrole: EmployeeSubrole | null;
    company: {
      id: string;
      name: string;
      email: string;
    } | null;
  };
  sessions?: any[];
  stats?: {
    pending: number;
    inProgress: number;
    completed: number;
    total: number;
  };
  verifiedSeals?: any[];
  verificationStats?: {
    totalVerified: number;
  };
  companySessions?: any[];
};

async function handler() {
  try {
    const session = await getServerSession(authOptions);
    const employeeId = session?.user.id;
    const employeeSubrole = session?.user.subrole;

    // Get employee details with company
    const { data: employee, error: employeeError } = await supabase
      .from('users')
      .select('*, company:companyId(id, name, email)')
      .eq('id', employeeId)
      .single();

    if (employeeError || !employee) {
      console.error('Error fetching employee:', employeeError);
      return NextResponse.json(
        { error: "Employee not found" },
        { status: 404 }
      );
    }

    const dashboardData: DashboardData = {
      employee: {
        id: employee.id,
        name: employee.name,
        email: employee.email,
        subrole: employee.subrole as EmployeeSubrole | null,
        company: employee.company,
      },
    };

    // Role-specific dashboard data
    switch (employeeSubrole) {
      case EmployeeSubrole.OPERATOR:
        // Get sessions created by this operator
        const { data: createdSessions, error: sessionsError } = await supabase
          .from('sessions')
          .select('*, seal:id(*)')
          .eq('createdById', employeeId)
          .order('createdAt', { ascending: false })
          .limit(20);
        
        if (sessionsError) {
          console.error('Error fetching sessions:', sessionsError);
        }

        // Get session counts by status
        const { count: pendingCount, error: pendingError } = await supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('createdById', employeeId)
          .eq('status', "PENDING");

        const { count: inProgressCount, error: inProgressError } = await supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('createdById', employeeId)
          .eq('status', "IN_PROGRESS");

        const { count: completedCount, error: completedError } = await supabase
          .from('sessions')
          .select('*', { count: 'exact', head: true })
          .eq('createdById', employeeId)
          .eq('status', "COMPLETED");

        dashboardData.sessions = createdSessions || [];
        dashboardData.stats = {
          pending: pendingCount || 0,
          inProgress: inProgressCount || 0,
          completed: completedCount || 0,
          total: (pendingCount || 0) + (inProgressCount || 0) + (completedCount || 0),
        };
        break;

      case EmployeeSubrole.GUARD:
        // Get seals verified by this guard
        const { data: verifiedSeals, error: sealsError } = await supabase
          .from('seals')
          .select('*, session:sessionId(*, company:companyId(id, name))')
          .eq('verifiedById', employeeId)
          .order('scannedAt', { ascending: false })
          .limit(20);
        
        if (sealsError) {
          console.error('Error fetching verified seals:', sealsError);
        }

        // Get verified seal count
        const { count: totalVerifiedSeals, error: countError } = await supabase
          .from('seals')
          .select('*', { count: 'exact', head: true })
          .eq('verifiedById', employeeId);

        dashboardData.verifiedSeals = verifiedSeals || [];
        dashboardData.verificationStats = {
          totalVerified: totalVerifiedSeals || 0,
        };
        break;

      case EmployeeSubrole.DRIVER:
      case EmployeeSubrole.TRANSPORTER:
        // For these roles, just show the company's recent sessions
        if (employee.companyId) {
          const { data: companySessions, error: companySessionsError } = await supabase
            .from('sessions')
            .select('*, seal:id(*)')
            .eq('companyId', employee.companyId)
            .order('createdAt', { ascending: false })
            .limit(20);
          
          if (companySessionsError) {
            console.error('Error fetching company sessions:', companySessionsError);
          }

          dashboardData.companySessions = companySessions || [];
        }
        break;

      default:
        break;
    }

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error("Error fetching employee dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

// Only Employee users can access this dashboard
export const GET = withAuth(handler, [UserRole.EMPLOYEE]); 
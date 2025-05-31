import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { EmployeeSubrole, UserRole } from "@/lib/enums";
import { Company, Session, Seal, User } from "@prisma/client";

type DashboardData = {
  employee: {
    id: string;
    name: string;
    email: string;
    subrole: EmployeeSubrole | null;
    company: Pick<Company, 'id' | 'name' | 'email'> | null;
  };
  sessions?: Session[];
  stats?: {
    pending: number;
    inProgress: number;
    completed: number;
    total: number;
  };
  verifiedSeals?: (Seal & {
    session: Session & {
      company: Pick<Company, 'id' | 'name'>;
    };
  })[];
  verificationStats?: {
    totalVerified: number;
  };
  companySessions?: Session[];
};

async function handler() {
  try {
    const session = await getServerSession(authOptions);
    const employeeId = session?.user.id;
    const employeeSubrole = session?.user.subrole;

    // Get employee details with company
    const employee = await supabase.from('users').findUnique({
      where: { id: employeeId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!employee) {
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
        const createdSessions = await supabase.from('sessions').select('*').{
          where: { createdById: employeeId },
          take: 20,
          orderBy: { createdAt: "desc" },
          include: {
            seal: true,
          },
        });

        // Get session counts by status
        const pendingCount = await supabase.from('sessions').count({
          where: {
            createdById: employeeId,
            status: "PENDING",
          },
        });

        const inProgressCount = await supabase.from('sessions').count({
          where: {
            createdById: employeeId,
            status: "IN_PROGRESS",
          },
        });

        const completedCount = await supabase.from('sessions').count({
          where: {
            createdById: employeeId,
            status: "COMPLETED",
          },
        });

        dashboardData.sessions = createdSessions;
        dashboardData.stats = {
          pending: pendingCount,
          inProgress: inProgressCount,
          completed: completedCount,
          total: pendingCount + inProgressCount + completedCount,
        };
        break;

      case EmployeeSubrole.GUARD:
        // Get seals verified by this guard
        const verifiedSeals = await supabase.from('seals').select('*').{
          where: { verifiedById: employeeId },
          take: 20,
          orderBy: { scannedAt: "desc" },
          include: {
            session: {
              include: {
                company: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

        // Get verified seal count
        const totalVerifiedSeals = await supabase.from('seals').count({
          where: { verifiedById: employeeId },
        });

        dashboardData.verifiedSeals = verifiedSeals;
        dashboardData.verificationStats = {
          totalVerified: totalVerifiedSeals,
        };
        break;

      case EmployeeSubrole.DRIVER:
      case EmployeeSubrole.TRANSPORTER:
        // For these roles, just show the company's recent sessions
        if (employee.companyId) {
          const companySessions = await supabase.from('sessions').select('*').{
            where: { companyId: employee.companyId },
            take: 20,
            orderBy: { createdAt: "desc" },
            include: {
              seal: true,
            },
          });

          dashboardData.companySessions = companySessions;
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
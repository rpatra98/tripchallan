import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { EmployeeSubrole, UserRole } from "@/lib/enums";

async function handler() {
  try {
    // Get companies data
    const companies = await supabase.from('users').select('*').{
      where: { role: UserRole.COMPANY },
      select: {
        id: true,
        name: true,
        email: true,
        coins: true,
        createdAt: true,
      },
    });

    // Add employee counts to each company
    const companiesWithCounts = await Promise.all(
      companies.map(async (company) => {
        const employeeCount = await supabase.from('users').count({
          where: {
            companyId: company.id,
            role: UserRole.EMPLOYEE
          }
        });

        return {
          ...company,
          _count: {
            employees: employeeCount
          }
        };
      })
    );

    // Get employees data with company information
    const employees = await supabase.from('users').select('*').{
      where: { role: UserRole.EMPLOYEE },
      select: {
        id: true,
        name: true,
        email: true,
        subrole: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Get employee counts by subrole
    const operatorCount = await supabase.from('users').count({
      where: {
        role: UserRole.EMPLOYEE,
        subrole: EmployeeSubrole.OPERATOR,
      },
    });

    const driverCount = await supabase.from('users').count({
      where: {
        role: UserRole.EMPLOYEE,
        subrole: EmployeeSubrole.DRIVER,
      },
    });

    const transporterCount = await supabase.from('users').count({
      where: {
        role: UserRole.EMPLOYEE,
        subrole: EmployeeSubrole.TRANSPORTER,
      },
    });

    const guardCount = await supabase.from('users').count({
      where: {
        role: UserRole.EMPLOYEE,
        subrole: EmployeeSubrole.GUARD,
      },
    });

    // Get coin transactions summary
    const coinTransactions = await supabase.from('coinTransactions').select('*').{
      take: 10,
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

    // Calculate total coins with companies
    const companyCoins = await supabase.from('users').aggregate({
      where: { role: UserRole.COMPANY },
      _sum: {
        coins: true,
      },
    });

    // Get recent sessions
    const recentSessions = await supabase.from('sessions').select('*').{
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            subrole: true,
          },
        },
      },
    });

    return NextResponse.json({
      companies: {
        list: companiesWithCounts,
        count: companiesWithCounts.length,
      },
      employees: {
        list: employees,
        bySubrole: {
          operator: operatorCount,
          driver: driverCount,
          transporter: transporterCount,
          guard: guardCount,
          total: employees.length,
        },
      },
      coins: {
        transactions: coinTransactions,
        totalWithCompanies: companyCoins._sum.coins || 0,
      },
      recentSessions,
    });
  } catch (error) {
    console.error("Error fetching admin dashboard:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}

// Only Admin can access this dashboard
export const GET = withAuth(handler, [UserRole.ADMIN]); 
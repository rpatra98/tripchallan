import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { EmployeeSubrole, UserRole } from "@/lib/enums";

async function handler() {
  try {
    // Get companies data
    const { data: companies, error: companiesError } = await supabase
      .from('users')
      .select('id, name, email, coins, createdAt')
      .eq('role', UserRole.COMPANY);
    
    if (companiesError) {
      console.error('Error fetching companies:', companiesError);
      return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
    }

    // Add employee counts to each company
    const companiesWithCounts = await Promise.all(
      (companies || []).map(async (company) => {
        const { count: employeeCount, error: countError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('companyId', company.id)
          .eq('role', UserRole.EMPLOYEE);

        return {
          ...company,
          _count: {
            employees: employeeCount || 0
          }
        };
      })
    );

    // Get employees data with company information
    const { data: employees, error: employeesError } = await supabase
      .from('users')
      .select('id, name, email, subrole, createdAt, company:companyId(id, name)')
      .eq('role', UserRole.EMPLOYEE);
    
    if (employeesError) {
      console.error('Error fetching employees:', employeesError);
      return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
    }

    // Get employee counts by subrole
    const { count: operatorCount, error: opCountError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', UserRole.EMPLOYEE)
      .eq('subrole', EmployeeSubrole.OPERATOR);
    
    const { count: driverCount, error: driverCountError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', UserRole.EMPLOYEE)
      .eq('subrole', EmployeeSubrole.DRIVER);
    
    const { count: transporterCount, error: transporterCountError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', UserRole.EMPLOYEE)
      .eq('subrole', EmployeeSubrole.TRANSPORTER);
    
    const { count: guardCount, error: guardCountError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', UserRole.EMPLOYEE)
      .eq('subrole', EmployeeSubrole.GUARD);

    // Get coin transactions summary
    const { data: coinTransactions, error: transactionsError } = await supabase
      .from('coinTransactions')
      .select('*, fromUser:fromUserId(id, name, role), toUser:toUserId(id, name, role)')
      .order('createdAt', { ascending: false })
      .limit(10);
    
    if (transactionsError) {
      console.error('Error fetching coin transactions:', transactionsError);
      return NextResponse.json({ error: 'Failed to fetch coin transactions' }, { status: 500 });
    }

    // Calculate total coins with companies
    const { data: companyCoinsData, error: coinsError } = await supabase
      .from('users')
      .select('coins')
      .eq('role', UserRole.COMPANY);
    
    if (coinsError) {
      console.error('Error fetching company coins:', coinsError);
      return NextResponse.json({ error: 'Failed to fetch company coins' }, { status: 500 });
    }
    
    // Sum up the coins manually
    const totalCompanyCoins = (companyCoinsData || []).reduce((sum, company) => sum + (company.coins || 0), 0);

    // Get recent sessions
    const { data: recentSessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('*, company:companyId(id, name), createdBy:createdById(id, name, subrole)')
      .order('createdAt', { ascending: false })
      .limit(5);
    
    if (sessionsError) {
      console.error('Error fetching recent sessions:', sessionsError);
      return NextResponse.json({ error: 'Failed to fetch recent sessions' }, { status: 500 });
    }

    return NextResponse.json({
      companies: {
        list: companiesWithCounts,
        count: companiesWithCounts.length,
      },
      employees: {
        list: employees || [],
        bySubrole: {
          operator: operatorCount || 0,
          driver: driverCount || 0,
          transporter: transporterCount || 0,
          guard: guardCount || 0,
          total: (employees || []).length,
        },
      },
      coins: {
        transactions: coinTransactions || [],
        totalWithCompanies: totalCompanyCoins,
      },
      recentSessions: recentSessions || [],
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
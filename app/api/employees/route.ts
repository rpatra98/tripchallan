import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/lib/enums";

export async function GET(req: NextRequest) {
  try {
    // First check if there are any employees at all in the database
    try {
      const totalEmployeeCount = await supabase.from('users').count({
        where: {
          role: UserRole.EMPLOYEE,
        },
      });
      console.log("Total employees in database:", totalEmployeeCount);
    } catch (countErr) {
      console.error("Error counting employees:", countErr);
    }
    
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user from database to access all their properties
    const user = await supabase.from('users').findUnique({
      where: { 
        id: session.user.id 
      },
      select: {
        id: true,
        role: true,
        companyId: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Log specific user role information for debugging
    console.log("User role information:");
    console.log("- user.role:", user.role);
    console.log("- user.role type:", typeof user.role);
    console.log("- UserRole.ADMIN:", UserRole.ADMIN);
    console.log("- UserRole.ADMIN type:", typeof UserRole.ADMIN);
    console.log("- user.role === UserRole.ADMIN:", user.role === UserRole.ADMIN);
    console.log("- user.role === 'ADMIN':", user.role === 'ADMIN');
    console.log("- roles are string comparison:", String(user.role) === String(UserRole.ADMIN));

    // Get the company ID from the query parameters or determine from the session
    const url = new URL(req.url);
    let companyId = url.searchParams.get("companyId");
    const limit = parseInt(url.searchParams.get("limit") || "100", 10);

    console.log(`User role: ${user.role}, User ID: ${user.id}, User companyId: ${user.companyId}`);
    console.log(`Requested companyId from query: ${companyId}`);

    // For SUPERADMIN, allow fetching all employees if no companyId is specified
    if ((!companyId) && (user.role === UserRole.SUPERADMIN)) {
      console.log("SuperAdmin fetching all employees");
      
      try {
        const { data: allEmployees, error: employeesError } = await supabase
          .from('users')
          .select('*')
          .eq('role', UserRole.EMPLOYEE);

        if (employeesError) {
          console.error('Error fetching employees:', employeesError);
          return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
        }

        return NextResponse.json({ employees: allEmployees || [] });
      } catch (dbError) {
        console.error("Database error fetching all employees:", dbError);
        throw dbError;
      }
    }
    
    // For ADMIN, only fetch employees they created if no companyId specified
    if ((!companyId) && (user.role === UserRole.ADMIN)) {
      console.log("Admin fetching their created employees");
      
      try {
        // Find companies created by this admin
        const { data: createdCompanyUsers, error: companyError } = await supabase
          .from('users')
          .select('companyId')
          .eq('role', UserRole.COMPANY)
          .eq('createdById', user.id);
        
        if (companyError) {
          console.error('Error fetching companies created by admin:', companyError);
          return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 });
        }
        
        // Get the company IDs associated with these users
        const companyIds = (createdCompanyUsers || [])
          .filter(companyUser => companyUser.companyId)
          .map(companyUser => companyUser.companyId);
        
        // Find employees for these companies or directly created by admin
        if (companyIds.length > 0) {
          const { data: adminEmployees, error: employeesError } = await supabase
            .from('users')
            .select(`
              id, name, email, role, subrole, createdAt, coins,
              company:companyId(id, name, email)
            `)
            .eq('role', UserRole.EMPLOYEE)
            .in('companyId', companyIds)
            .order('createdAt', { ascending: false })
            .limit(limit);
          
          if (employeesError) {
            console.error('Error fetching admin employees:', employeesError);
            return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
          }
          
          console.log(`Found ${adminEmployees ? adminEmployees.length : 0} employees for admin ${user.id}`);
          return NextResponse.json({ employees: adminEmployees || [] });
        } else {
          // No companies found, return empty array
          console.log(`No companies found for admin ${user.id}`);
          return NextResponse.json({ employees: [] });
        }
      } catch (dbError) {
        console.error("Database error fetching admin employees:", dbError);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }
    }

    // Handle different user roles to determine the company ID
    if (!companyId) {
      if (user.role === UserRole.COMPANY) {
        // For COMPANY role, we need to:
        // 1. Find the actual company ID since the user.id is not the company ID
        // 2. Find all employees associated with this company
        
        const companyUser = await supabase.from('users').findFirst({
          where: { 
            id: user.id,
            role: UserRole.COMPANY
          },
          select: {
            companyId: true,
          }
        });
        
        if (companyUser && companyUser.companyId) {
          companyId = companyUser.companyId;
        } else {
          // If no companyId found, use the user's ID as they might be directly
          // associated with a company
          companyId = user.id;
        }
        
        console.log("Company user, using companyId:", companyId);
      } else if (user.role === UserRole.EMPLOYEE && user.companyId) {
        // If the user is an employee, use their company ID
        companyId = user.companyId;
        console.log("Employee user, using companyId:", companyId);
      }
    }

    if (!companyId) {
      return NextResponse.json({ error: "Company ID is required" }, { status: 400 });
    }

    // If an admin requests specific company's employees, ensure they created that company
    if (user.role === UserRole.ADMIN && companyId) {
      const companyUser = await supabase.from('users').findFirst({
        where: {
          companyId: companyId,
          role: UserRole.COMPANY
        },
        select: {
          id: true,
          createdById: true
        }
      });
      
      // Only allow access if admin created this company
      if (companyUser && companyUser.createdById !== user.id) {
        return NextResponse.json({ error: "You don't have permission to view employees for this company" }, { status: 403 });
      }
    }

    // Check if the requesting user has permission to view these employees
    const hasPermission = 
      user.role === UserRole.SUPERADMIN ||
      user.role === UserRole.ADMIN ||
      (user.role === UserRole.COMPANY && (user.id === companyId || user.companyId === companyId)) ||
      (user.role === UserRole.EMPLOYEE && user.companyId === companyId);

    if (!hasPermission) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    console.log("Fetching employees for company:", companyId);

    // Fetch employees for the company
    const employees = await supabase.from('users').select('*').{
      where: {
        role: UserRole.EMPLOYEE,
        companyId: companyId,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subrole: true,
        createdAt: true,
        coins: true,
        company: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    console.log(`Found ${employees.length} employees for company ${companyId}`);
    
    return NextResponse.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
} 
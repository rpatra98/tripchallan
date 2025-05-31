import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { UserRole, EmployeeSubrole } from "@/lib/enums";

async function handler(req: NextRequest, context?: { params: Record<string, string> }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    if (!context || !context.params.id) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }
    
    const companyId = context.params.id;
    
    // Check if the company exists
    const company = await supabase.from('users').select('*').eq('id', companyId).single();
    
    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }
    
    // Only allow access to the company itself or admins/superadmins
    if (
      session.user.id !== companyId && 
      session.user.role !== UserRole.SUPERADMIN && 
      session.user.role !== UserRole.ADMIN
    ) {
      return NextResponse.json(
        { error: "Not authorized to view this company's employees" },
        { status: 403 }
      );
    }
    
    console.log(`Fetching employees for company ID: ${companyId}`);
    
    // Get the company's email to filter out self-admin
    const companyEmail = company.email;
    
    // First, find the actual Company record if it exists
    const companyRecord = await supabase.from('companys').findFirst({
      where: {
        OR: [
          { id: companyId },
          {
            employees: {
              some: {
                id: companyId
              }
            }
          }
        ]
      },
      include: {
        employees: {
          where: {
            role: UserRole.EMPLOYEE,
            email: {
              not: companyEmail // Exclude self-admin (matches company email)
            },
            subrole: {
              in: [EmployeeSubrole.GUARD, EmployeeSubrole.OPERATOR] // Only include GUARD and OPERATOR
            }
          },
          select: {
            id: true
          }
        }
      }
    });
    
    console.log(`Company record found: ${!!companyRecord}, Employee count: ${companyRecord?.employees?.length || 0}`);
    
    // Get employee IDs from the company relationship if available
    const employeeIdsFromCompany = companyRecord?.employees?.map((e: { id: string }) => e.id) || [];
    
    // Get all employees associated with this company through all possible paths
    const employees = await supabase.from('users').select('*').{
      where: {
        AND: [
          {
            email: {
              not: companyEmail // Exclude self-admin (matches company email)
            }
          },
          {
            subrole: {
              in: [EmployeeSubrole.GUARD, EmployeeSubrole.OPERATOR] // Only include GUARD and OPERATOR
            }
          },
          {
            OR: [
              // Direct association via companyId field
              {
                companyId: companyId,
                role: UserRole.EMPLOYEE
              },
              // Indirect association via company.employees relation
              {
                company: {
                  id: companyId
                },
                role: UserRole.EMPLOYEE
              },
              // Created by this company
              {
                createdById: companyId,
                role: UserRole.EMPLOYEE
              },
              // Found through Company.employees relation
              {
                id: {
                  in: employeeIdsFromCompany
                }
              }
            ]
          }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        subrole: true,
        coins: true,
        createdAt: true,
        companyId: true,
        createdById: true,
      },
      orderBy: {
        name: "asc",
      },
    });
    
    console.log(`Found ${employees.length} employees for company ${companyId}`);
    
    // If we still don't have any employees but we have a company record,
    // try one more approach - get all employees where companyId matches the companyRecord.id
    if (employees.length === 0 && companyRecord && companyRecord.id !== companyId) {
      console.log(`Trying a fallback approach with company ID: ${companyRecord.id}`);
      
      const fallbackEmployees = await supabase.from('users').select('*').{
        where: {
          companyId: companyRecord.id,
          role: UserRole.EMPLOYEE,
          email: {
            not: companyEmail // Exclude self-admin (matches company email)
          },
          subrole: {
            in: [EmployeeSubrole.GUARD, EmployeeSubrole.OPERATOR] // Only include GUARD and OPERATOR
          }
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          subrole: true,
          coins: true,
          createdAt: true,
          companyId: true,
          createdById: true,
        },
        orderBy: {
          name: "asc",
        },
      });
      
      console.log(`Fallback found ${fallbackEmployees.length} employees`);
      
      if (fallbackEmployees.length > 0) {
        return NextResponse.json(fallbackEmployees);
      }
    }
    
    return NextResponse.json(employees);
  } catch (error) {
    console.error("Error fetching company employees:", error);
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
}

// Allow access to authenticated users with appropriate roles
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
]); 
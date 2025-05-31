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
    const { data: company, error: companyError } = await supabase
      .from('users')
      .select('*')
      .eq('id', companyId)
      .eq('role', UserRole.COMPANY)
      .single();
    
    if (companyError || !company) {
      console.error('Error fetching company:', companyError);
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
    
    // Get employees directly associated with this company
    const { data: employees, error: employeesError } = await supabase
      .from('users')
      .select('*')
      .eq('companyId', companyId)
      .eq('role', UserRole.EMPLOYEE)
      .in('subrole', [EmployeeSubrole.GUARD, EmployeeSubrole.OPERATOR])
      .neq('email', company.email) // Exclude self-admin
      .order('name');
    
    if (employeesError) {
      console.error('Error fetching employees:', employeesError);
      return NextResponse.json(
        { error: "Failed to fetch employees" },
        { status: 500 }
      );
    }
    
    console.log(`Found ${employees?.length || 0} employees for company ${companyId}`);
    
    // Get employees created by this company
    const { data: createdEmployees, error: createdError } = await supabase
      .from('users')
      .select('*')
      .eq('createdById', companyId)
      .eq('role', UserRole.EMPLOYEE)
      .in('subrole', [EmployeeSubrole.GUARD, EmployeeSubrole.OPERATOR])
      .neq('email', company.email) // Exclude self-admin
      .order('name');
    
    if (createdError) {
      console.error('Error fetching created employees:', createdError);
      // Continue anyway, just log the error
    }
    
    // Combine both sets of employees and deduplicate by ID
    const allEmployees = [...(employees || [])];
    
    if (createdEmployees && createdEmployees.length > 0) {
      console.log(`Found ${createdEmployees.length} employees created by company ${companyId}`);
      
      // Add employees not already in the list
      createdEmployees.forEach(emp => {
        if (!allEmployees.some(e => e.id === emp.id)) {
          allEmployees.push(emp);
        }
      });
    }
    
    return NextResponse.json(allEmployees);
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
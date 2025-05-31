import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/lib/enums";
import { hash } from "bcrypt";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`Attempting to fetch employee with ID: ${params.id}`);
    
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      console.log('Unauthorized: No session or user');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    console.log(`User attempting access: ${session.user.id}, role: ${session.user.role}`);
    
    // Get the employee with detailed information
    const employee = await supabase.from('users').findUnique({
      where: { id: params.id, role: UserRole.EMPLOYEE },
      include: {
        company: {
          select: {
            id: true,
            name: true
          }
        },
        operatorPermissions: true
      }
    });
    
    if (!employee) {
      console.log('Employee not found');
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    
    console.log('Employee found:', {
      id: employee.id,
      companyId: employee.companyId,
      company: employee.company
    });
    
    // Check if the current user has permission to view this employee
    const isAdmin = session.user.role === UserRole.ADMIN || session.user.role === UserRole.SUPERADMIN;
    const isSelf = session.user.id === params.id; // Allow users to view themselves
    
    // For company users, we need to check if the employee belongs to them
    let hasCompanyAccess = false;
    
    if (session.user.role === UserRole.COMPANY) {
      const companyId = session.user.id;
      
      // First check direct relationship
      if (employee.companyId === companyId) {
        hasCompanyAccess = true;
      }
      // Then check company field relationship
      else if (employee.company && employee.company.id === companyId) {
        hasCompanyAccess = true;
      }
      // Try to find a Company record association
      else {
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
                id: employee.id
              }
            }
          }
        });
        
        if (companyRecord && companyRecord.employees && companyRecord.employees.length > 0) {
          hasCompanyAccess = true;
        }
      }
      
      console.log(`Company access check for ${session.user.id} to employee ${params.id}: ${hasCompanyAccess}`);
    }
    
    // Allow access if: admin, self, or company with proper association
    if (!isAdmin && !isSelf && !hasCompanyAccess) {
      console.log('Access denied: User does not have permission to view this employee');
      return NextResponse.json(
        { error: "You don't have permission to view this employee" }, 
        { status: 403 }
      );
    }
    
    console.log('Access granted to employee details');
    return NextResponse.json(employee);
  } catch (error) {
    console.error("Error fetching employee:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Check if user has admin permissions
    const currentUser = await supabase.from('users').findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true }
    });
    
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const isAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPERADMIN;
    
    if (!isAdmin) {
      return NextResponse.json({ error: "Only administrators can update employees" }, { status: 403 });
    }
    
    // Parse the request body
    const body = await request.json();
    const { name, email, password, companyId, subrole, coins, permissions } = body;
    
    // Check if employee exists
    const employee = await supabase.from('users').select('*').eq('id', params.id).single();
    
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    
    // Build the update data
    const updateData: any = {
      name,
      email,
      companyId,
      subrole,
      coins: Number(coins)
    };
    
    // Only hash and update password if provided
    if (password) {
      const hashedPassword = await hash(password, 10);
      updateData.password = hashedPassword;
    }
    
    // Update the employee
    const updatedEmployee = await supabase.from('users').update( updateData,
    });
    
    // Update operator permissions if provided
    if (permissions && subrole === "OPERATOR") {
      // Check if permissions record exists
      const existingPermissions = await supabase.from('operatorPermissionss').select('*').eq('userId', params.id).single();
      
      if (existingPermissions) {
        // Update existing permissions
        await supabase.from('operatorPermissionss').update( {
            canCreate: permissions.canCreate,
            canModify: permissions.canModify,
            canDelete: permissions.canDelete
          }
        });
      } else {
        // Create new permissions
        await supabase.from('operatorPermissionss').insert( {
            userId: params.id,
            canCreate: permissions.canCreate,
            canModify: permissions.canModify,
            canDelete: permissions.canDelete
          }
        });
      }
    }
    
    return NextResponse.json({ 
      message: "Employee updated successfully", 
      employee: updatedEmployee 
    });
  } catch (error) {
    console.error("Error updating employee:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`Attempting to delete employee with ID: ${params.id}`);
    
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      console.log('Unauthorized: No session or user');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    console.log(`User attempting delete: ${session.user.id}, role: ${session.user.role}`);
    
    // Only ADMIN and SUPERADMIN can delete employees
    if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.SUPERADMIN) {
      return NextResponse.json(
        { error: "Only administrators can delete employees" }, 
        { status: 403 }
      );
    }
    
    // Check if employee exists
    const employee = await supabase.from('users').findUnique({
      where: { 
        id: params.id, 
        role: UserRole.EMPLOYEE 
      },
      include: {
        company: {
          select: {
            id: true,
            name: true
          }
        },
        // Check for associated sessions
        createdSessions: {
          select: { id: true },
          take: 1
        },
        // Check for any other important relationships
        operatorPermissions: true
      }
    });
    
    if (!employee) {
      console.log('Employee not found');
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    
    console.log('Employee found:', {
      id: employee.id,
      name: employee.name,
      email: employee.email,
      companyId: employee.companyId,
      company: employee.company,
      hasCreatedSessions: employee.createdSessions.length > 0
    });
    
    // Check if there are associated resources that would prevent deletion
    if (employee.createdSessions.length > 0) {
      return NextResponse.json(
        { 
          error: "Cannot delete employee with associated sessions. Transfer or delete their sessions first.",
          resourceCount: employee.createdSessions.length 
        },
        { status: 400 }
      );
    }
    
    // Delete associated data first
    if (employee.operatorPermissions) {
      await supabase.from('operatorPermissionss').delete().eq('userId', employee.id);
    }
    
    // Delete the employee
    await supabase.from('users').delete().eq('id', params.id);
    
    console.log(`Successfully deleted employee ${employee.name} (${employee.id})`);
    
    return NextResponse.json({ 
      success: true,
      message: "Employee deleted successfully" 
    });
    
  } catch (error) {
    console.error("Error deleting employee:", error);
    return NextResponse.json(
      { error: "Failed to delete employee", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 
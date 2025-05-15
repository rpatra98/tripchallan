import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import { hash } from "bcrypt";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`Attempting to fetch employee with ID: ${params.id}`);
    
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      console.log('Unauthorized: No session or user');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    console.log(`User attempting access: ${session.user.id}, role: ${session.user.role}`);
    
    // Check for authorization
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        id: true, 
        role: true, 
        companyId: true 
      }
    });
    
    if (!currentUser) {
      console.log('Unauthorized: User not found in database');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Get the employee with detailed information
    const employee = await prisma.user.findUnique({
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
    const isAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPERADMIN;
    const isCompany = currentUser.role === UserRole.COMPANY;
    
    // Multiple ways to check company-employee relationship
    let isEmployeeOfCompany = false;
    
    if (isCompany) {
      // Method 1: Direct companyId match
      const directMatch = currentUser.id === employee.companyId;
      
      // Method 2: Check if company relation points to current user
      const companyMatch = employee.company && employee.company.id === currentUser.id;
      
      isEmployeeOfCompany = directMatch || companyMatch;
      
      console.log('Company-Employee relationship checks:', {
        directMatch,
        companyMatch,
        finalResult: isEmployeeOfCompany
      });
    }
    
    console.log('Full auth check:', {
      currentUserId: currentUser.id,
      currentUserRole: currentUser.role,
      employeeCompanyId: employee.companyId,
      employeeCompanyObj: employee.company,
      isAdmin,
      isCompany,
      isEmployeeOfCompany
    });
    
    // Allow access if user is an admin or the company that owns this employee
    if (!isAdmin && !isEmployeeOfCompany) {
      console.log('Access denied: User is not admin and not the company owner of this employee');
      return NextResponse.json({ error: "Unauthorized: You don't have permission to view this employee" }, { status: 403 });
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
    const currentUser = await prisma.user.findUnique({
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
    const employee = await prisma.user.findUnique({
      where: { id: params.id, role: UserRole.EMPLOYEE },
    });
    
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
    const updatedEmployee = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
    });
    
    // Update operator permissions if provided
    if (permissions && subrole === "OPERATOR") {
      // Check if permissions record exists
      const existingPermissions = await prisma.operatorPermissions.findUnique({
        where: { userId: params.id }
      });
      
      if (existingPermissions) {
        // Update existing permissions
        await prisma.operatorPermissions.update({
          where: { userId: params.id },
          data: {
            canCreate: permissions.canCreate,
            canModify: permissions.canModify,
            canDelete: permissions.canDelete
          }
        });
      } else {
        // Create new permissions
        await prisma.operatorPermissions.create({
          data: {
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
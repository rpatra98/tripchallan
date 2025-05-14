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
    // Get the authenticated user's session
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Check for authorization
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, role: true, companyId: true }
    });
    
    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Get the employee
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
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    
    // Check if the current user has permission to view this employee
    const isAdmin = currentUser.role === UserRole.ADMIN || currentUser.role === UserRole.SUPERADMIN;
    const isEmployeeCompany = currentUser.id === employee.companyId;
    
    if (!isAdmin && !isEmployeeCompany) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
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
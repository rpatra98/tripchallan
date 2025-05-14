import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

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
    
    // Get the employee details
    const employee = await prisma.user.findUnique({
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
        operatorPermissions: true
      }
    });
    
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    
    // Check if the user has permission to view this employee
    const isAdmin = [UserRole.ADMIN, UserRole.SUPERADMIN].includes(currentUser.role as UserRole);
    const isEmployeeCompany = currentUser.id === employee.companyId || 
                              currentUser.companyId === employee.companyId;
    
    if (!isAdmin && !isEmployeeCompany) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    
    // Return the employee details
    return NextResponse.json(employee);
    
  } catch (error) {
    console.error("Error fetching employee details:", error);
    return NextResponse.json(
      { error: "Failed to fetch employee details" },
      { status: 500 }
    );
  }
} 
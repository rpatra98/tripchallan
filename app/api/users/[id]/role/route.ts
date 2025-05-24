import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const userId = params.id;
    console.log("Role API called for user ID:", userId);
    
    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }
    
    // Allow users to fetch their own role or superadmins to fetch any role
    if (session.user.id !== userId && session.user.role !== UserRole.SUPERADMIN) {
      // Additional check for ADMIN and COMPANY users to fetch roles of their subordinates
      if (
        (session.user.role === UserRole.ADMIN || session.user.role === UserRole.COMPANY) && 
        !(await canAccessUserRole(session.user.id, userId))
      ) {
        return NextResponse.json(
          { error: "You don't have permission to access this user's role" },
          { status: 403 }
        );
      }
    }
    
    // Fetch the user role and subrole
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        subrole: true
      }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    console.log("Found user role data:", {
      id: user.id,
      role: user.role,
      subrole: user.subrole
    });
    
    return NextResponse.json({
      role: user.role,
      subrole: user.subrole
    });
  } catch (error) {
    console.error("Error fetching user role:", error);
    return NextResponse.json(
      { error: "Failed to fetch user role" },
      { status: 500 }
    );
  }
}

// Helper function to check if a user can access another user's role
async function canAccessUserRole(requesterId: string, targetUserId: string): Promise<boolean> {
  const requester = await prisma.user.findUnique({
    where: { id: requesterId },
    select: { role: true }
  });
  
  if (!requester) return false;
  
  // For ADMIN users
  if (requester.role === UserRole.ADMIN) {
    // Check if the admin created this user
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { createdById: true, companyId: true, role: true }
    });
    
    if (targetUser?.createdById === requesterId) {
      return true;
    }
    
    // Also allow access to employees of companies the admin manages
    if (targetUser?.role === UserRole.EMPLOYEE) {
      const company = await prisma.user.findUnique({
        where: { id: targetUser.companyId || "" },
        select: { createdById: true }
      });
      
      if (company?.createdById === requesterId) {
        return true;
      }
    }
  }
  
  // For COMPANY users
  if (requester.role === UserRole.COMPANY) {
    // Companies can access their employees' roles
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { companyId: true, role: true }
    });
    
    if (targetUser?.role === UserRole.EMPLOYEE && targetUser?.companyId === requesterId) {
      return true;
    }
  }
  
  return false;
} 
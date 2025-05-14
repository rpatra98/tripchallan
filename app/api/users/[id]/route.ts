import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { UserRole } from "@/prisma/enums";

// Use this format that matches other API routes in the project
export const GET = withAuth(
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      
      if (!session || !session.user) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }
      
      // Extract ID from the URL
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const targetUserId = pathParts[pathParts.indexOf('users') + 1];
      
      // Add debug info
      console.log("API request for user ID:", targetUserId);
      console.log("Pathname:", url.pathname);
      console.log("Path parts:", pathParts);
      
      if (!targetUserId) {
        return NextResponse.json(
          { error: "User ID is required" },
          { status: 400 }
        );
      }
      
      const requesterId = session.user.id;
      const requesterRole = session.user.role;
      
      // Authorization check - only allow users to:
      // 1. Access their own data
      // 2. SuperAdmins can access any user
      // 3. Admins can access users they created or companies they manage
      // 4. Companies can access their employees
      
      let canAccessUser = requesterId === targetUserId; // Users can always access their own data
      
      if (!canAccessUser && requesterRole === UserRole.SUPERADMIN) {
        canAccessUser = true; // SuperAdmins can access any user
      }
      
      if (!canAccessUser && requesterRole === UserRole.ADMIN) {
        // Check if the target user was created by this admin
        const targetUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: { createdById: true, companyId: true, role: true }
        });
        
        if (targetUser?.createdById === requesterId) {
          canAccessUser = true;
        }
        
        // Also allow access to employees of companies the admin manages
        if (!canAccessUser && targetUser?.role === UserRole.EMPLOYEE) {
          // First check if the company was created by this admin
          const company = await prisma.user.findUnique({
            where: { id: targetUser.companyId || "" },
            select: { createdById: true }
          });
          
          if (company?.createdById === requesterId) {
            canAccessUser = true;
          }
        }
      }
      
      if (!canAccessUser && requesterRole === UserRole.COMPANY) {
        // Companies can access their employees
        const targetUser = await prisma.user.findUnique({
          where: { id: targetUserId },
          select: { companyId: true, role: true }
        });
        
        if (targetUser?.role === UserRole.EMPLOYEE && targetUser?.companyId === requesterId) {
          canAccessUser = true;
        }
      }
      
      if (!canAccessUser) {
        return NextResponse.json(
          { error: "You are not authorized to access this user's data" },
          { status: 403 }
        );
      }
      
      // Fetch the user with appropriate related data
      const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        include: {
          company: {
            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true,
              updatedAt: true
            }
          }
        }
      });
      
      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
      
      // Remove sensitive fields
      const { password, ...userWithoutPassword } = user;
      
      return NextResponse.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Error fetching user by ID:", error);
      return NextResponse.json(
        { error: "Failed to fetch user" },
        { status: 500 }
      );
    }
  },
  [
    UserRole.SUPERADMIN, 
    UserRole.ADMIN, 
    UserRole.COMPANY, 
    UserRole.EMPLOYEE
  ]
); 
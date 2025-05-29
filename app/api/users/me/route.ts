import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import prismaHelper from "@/lib/prisma-helper";
import { withAuth } from "@/lib/auth";
import { UserRole } from "@/lib/types";

export const GET = withAuth(
  async () => {
    try {
      const session = await getServerSession(authOptions);
      
      if (!session || !session.user) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }
      
      // Get user details with company info
      const user = await prismaHelper.executePrismaWithRetry(async () => {
        return prisma.user.findUnique({
          where: { id: session.user.id },
          include: {
            company: true
          }
        });
      });
      
      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
      
      // Remove sensitive fields
      const { password, ...userWithoutPassword } = user;
      
      return NextResponse.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user details:", error);
      
      // Check if this is a prepared statement error and try to handle it
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isPreparedStatementError = 
        errorMessage.includes('prepared statement') || 
        errorMessage.includes('42P05');
      
      if (isPreparedStatementError) {
        try {
          // Try to reset the connection
          await prismaHelper.resetConnection();
        } catch (resetError) {
          console.error("Failed to reset connection:", resetError);
        }
      }
      
      return NextResponse.json(
        { error: "Failed to fetch user details", details: errorMessage },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY, UserRole.EMPLOYEE]
); 
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { UserRole } from "@/prisma/enums";
import prisma from "@/lib/prisma";

/**
 * Direct database access endpoint for activity logs debugging
 * This completely bypasses permission checks and is only for SUPERADMIN users
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== UserRole.SUPERADMIN) {
      return NextResponse.json({ error: "Unauthorized. Only SUPERADMIN can access this endpoint." }, { status: 401 });
    }
    
    console.log("Direct database query for activity logs debugging");
    
    // Get all logs directly from database with no filtering
    const logs = await prisma.activityLog.findMany({
      orderBy: {
        createdAt: "desc"
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        targetUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });
    
    return NextResponse.json({
      logs,
      meta: {
        totalItems: logs.length,
        currentPage: 1,
        totalPages: 1,
        itemsPerPage: logs.length,
        hasNextPage: false,
        hasPrevPage: false
      }
    });
  } catch (error) {
    console.error("Error in direct database query:", error);
    return NextResponse.json(
      { error: "Failed to query activity logs database directly", details: String(error) },
      { status: 500 }
    );
  }
}
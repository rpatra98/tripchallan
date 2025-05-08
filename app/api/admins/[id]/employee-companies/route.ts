// Using any type as a fallback to avoid TypeScript errors
// @ts-ignore
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

interface RouteParams {
  params: {
    id: string;
  };
}

export const GET = withAuth(
  async (req: NextRequest, context: any) => {
    try {
      const { params } = context;
      const adminId = params.id;
      const session = await getServerSession(authOptions);
      
      // Only SuperAdmin can view admin details
      if (session?.user.role !== UserRole.SUPERADMIN) {
        return NextResponse.json(
          { error: "Unauthorized. Only SuperAdmin can view admin details" },
          { status: 403 }
        );
      }
      
      // Verify admin exists
      const admin = await prisma.user.findFirst({
        where: {
          id: adminId,
          role: UserRole.ADMIN
        }
      });
      
      if (!admin) {
        return NextResponse.json(
          { error: "Admin not found" },
          { status: 404 }
        );
      }
      
      // Get unique company IDs where the admin has created users
      const companyUsersQuery = await prisma.user.findMany({
        where: {
          createdById: adminId,
          NOT: {
            companyId: null
          }
        },
        select: {
          companyId: true
        },
        distinct: ['companyId']
      });
      
      const companyIds = companyUsersQuery
        .filter((item: any) => item.companyId)
        .map((item: any) => item.companyId);
      
      // Get companies based on these IDs
      let companies = [];
      if (companyIds.length > 0) {
        companies = await prisma.company.findMany({
          where: {
            id: {
              in: companyIds as string[]
            }
          },
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            updatedAt: true,
          },
          orderBy: { name: "asc" },
        });
      }
      
      return NextResponse.json({ companies });
    } catch (error) {
      console.error("Error fetching admin employee companies:", error);
      return NextResponse.json(
        { error: "Failed to fetch companies" },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN]
); 
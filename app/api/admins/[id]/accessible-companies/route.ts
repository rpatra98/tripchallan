import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

export const GET = withAuth(
  async (req: NextRequest, context: { params: Record<string, string> } | undefined) => {
    try {
      if (!context || !context.params) {
        return NextResponse.json(
          { error: "Invalid route parameters" },
          { status: 400 }
        );
      }
      
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
      
      // Find companies created by this admin
      const companyUsers = await prisma.user.findMany({
        where: {
          role: UserRole.COMPANY,
          createdById: adminId,
        },
        select: {
          id: true,
          companyId: true,
        }
      });
      
      // Get the company IDs associated with these users
      const companyIds = companyUsers
        .filter((user: { companyId?: string }) => user.companyId)
        .map((user: { companyId?: string }) => user.companyId);
      
      // Also find companies where the admin has created any users
      const adminEmployeeCreations = await prisma.user.findMany({
        where: {
          role: UserRole.EMPLOYEE,
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
      
      // Add company IDs from employee creation relationships
      const employeeCompanyIds = adminEmployeeCreations
        .filter((user: { companyId?: string }) => user.companyId)
        .map((user: { companyId?: string }) => user.companyId);
      
      // Combine both sets of company IDs without duplicates
      const uniqueCompanyIds = [...new Set([...companyIds, ...employeeCompanyIds])];
      
      // Also check for custom permissions if that table exists
      try {
        const customPermCheck = await prisma.$queryRaw`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = 'custom_permissions'
          )`;
          
        if (customPermCheck && customPermCheck[0] && customPermCheck[0].exists) {
          const customPerms = await prisma.$queryRaw`
            SELECT resource_id FROM custom_permissions 
            WHERE permission_type = 'ADMIN_COMPANY' 
            AND user_id = ${adminId}`;
            
          if (customPerms && customPerms.length > 0) {
            // Add these company IDs to the list
            customPerms.forEach((perm: { resource_id?: string }) => {
              if (perm.resource_id && !uniqueCompanyIds.includes(perm.resource_id)) {
                uniqueCompanyIds.push(perm.resource_id);
              }
            });
          }
        }
      } catch (err) {
        console.error("Error checking custom permissions for companies:", err);
        // Continue without failing
      }
      
      // Get companies based on the combined IDs
      let companies = [];
      if (uniqueCompanyIds.length > 0) {
        companies = await prisma.company.findMany({
          where: {
            id: {
              in: uniqueCompanyIds as string[]
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
      console.error("Error fetching admin accessible companies:", error);
      return NextResponse.json(
        { error: "Failed to fetch admin accessible companies" },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN]
); 
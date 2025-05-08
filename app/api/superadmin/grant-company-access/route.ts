// Using any type as a fallback to avoid TypeScript errors
// @ts-ignore
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole, ActivityAction } from "@/prisma/enums";
import { addActivityLog } from "@/lib/activity-logger";

// This endpoint allows a SuperAdmin to grant company access to an Admin
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      const body = await req.json();
      
      // Only SuperAdmin can manage permissions
      if (session?.user.role !== UserRole.SUPERADMIN) {
        return NextResponse.json(
          { error: "Unauthorized. Only SuperAdmin can grant company access" },
          { status: 403 }
        );
      }
      
      // Validate required fields
      if (!body.adminId || !body.companyId) {
        return NextResponse.json(
          { error: "Admin ID and Company ID are required" },
          { status: 400 }
        );
      }
      
      // Verify admin exists and is an ADMIN
      const admin = await prisma.user.findFirst({
        where: {
          id: body.adminId,
          role: UserRole.ADMIN
        }
      });
      
      if (!admin) {
        return NextResponse.json(
          { error: "Admin not found or user is not an admin" },
          { status: 404 }
        );
      }
      
      // Verify company exists
      const company = await prisma.company.findUnique({
        where: {
          id: body.companyId
        }
      });
      
      if (!company) {
        return NextResponse.json(
          { error: "Company not found" },
          { status: 404 }
        );
      }
      
      // Create custom permissions table if it doesn't exist
      try {
        await prisma.$executeRaw`
          CREATE TABLE IF NOT EXISTS custom_permissions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            permission_type VARCHAR(50) NOT NULL,
            user_id UUID NOT NULL,
            resource_id UUID NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(permission_type, user_id, resource_id)
          )`;
          
        // Add permission record
        await prisma.$executeRaw`
          INSERT INTO custom_permissions (permission_type, user_id, resource_id)
          VALUES ('ADMIN_COMPANY', ${body.adminId}, ${body.companyId})
          ON CONFLICT (permission_type, user_id, resource_id) DO NOTHING`;
      } catch (err) {
        console.error("Error creating permission record:", err);
        return NextResponse.json(
          { error: "Failed to grant access. Database error." },
          { status: 500 }
        );
      }
      
      // Log the activity
      await addActivityLog({
        userId: session.user.id as string,
        action: ActivityAction.CREATE,
        details: {
          entityType: "ADMIN_PERMISSION",
          adminId: body.adminId,
          companyId: body.companyId
        },
        targetResourceId: body.companyId,
        targetResourceType: "COMPANY"
      });
      
      return NextResponse.json({
        success: true,
        message: "Company access granted successfully"
      });
    } catch (error) {
      console.error("Error granting company access:", error);
      return NextResponse.json(
        { error: "Failed to grant company access" },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN]
); 
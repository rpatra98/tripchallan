import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { withAuth } from "@/lib/auth";
import { UserRole, EmployeeSubrole, ActivityAction } from "@/prisma/enums";
import { addActivityLog } from "@/lib/activity-logger";

// GET endpoint to fetch operator permissions
export const GET = withAuth(
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      // Extract ID from URL
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const employeeId = pathParts[pathParts.indexOf('employees') + 1];

      // Check authorization
      const userRole = session.user.role;
      const userId = session.user.id;

      if (userRole !== UserRole.ADMIN && userRole !== UserRole.SUPERADMIN) {
        return NextResponse.json(
          { error: "Only admins can view operator permissions" },
          { status: 403 }
        );
      }

      // Fetch employee details to verify it's an operator
      const employee = await prisma.user.findUnique({
        where: { id: employeeId },
        include: {
          operatorPermissions: true
        }
      });

      if (!employee) {
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 }
        );
      }

      // Verify this is an operator
      if (employee.role !== UserRole.EMPLOYEE || employee.subrole !== EmployeeSubrole.OPERATOR) {
        return NextResponse.json(
          { error: "This user is not an operator" },
          { status: 400 }
        );
      }

      // For ADMIN role, check if they created this employee
      if (userRole === UserRole.ADMIN) {
        if (employee.createdById !== userId) {
          // Check if admin created any company user linked to this employee
          const employeeCompany = await prisma.user.findFirst({
            where: {
              id: employee.companyId || "",
              createdById: userId
            }
          });
          
          if (!employeeCompany) {
            return NextResponse.json(
              { error: "You do not have permission to view this operator's permissions" },
              { status: 403 }
            );
          }
        }
      }

      // Return the permissions
      return NextResponse.json(employee.operatorPermissions || {
        canCreate: false,  // Default values if no permissions set - safer to default to false
        canModify: false,
        canDelete: false
      });
    } catch (error) {
      console.error("Error fetching operator permissions:", error);
      return NextResponse.json(
        { error: "Failed to fetch operator permissions" },
        { status: 500 }
      );
    }
  },
  [UserRole.ADMIN, UserRole.SUPERADMIN]
);

// PUT endpoint to update operator permissions
export const PUT = withAuth(
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      // Extract ID from URL
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const employeeId = pathParts[pathParts.indexOf('employees') + 1];

      // Check authorization
      const userRole = session.user.role;
      const userId = session.user.id;

      if (userRole !== UserRole.ADMIN && userRole !== UserRole.SUPERADMIN) {
        return NextResponse.json(
          { error: "Only admins can modify operator permissions" },
          { status: 403 }
        );
      }

      // Get the update data
      const permissions = await req.json();

      // Validate the permissions data
      if (typeof permissions.canCreate !== 'boolean' ||
          typeof permissions.canModify !== 'boolean' ||
          typeof permissions.canDelete !== 'boolean') {
        return NextResponse.json(
          { error: "Invalid permissions format" },
          { status: 400 }
        );
      }

      // Fetch employee details to verify it's an operator
      const employee = await prisma.user.findUnique({
        where: { id: employeeId },
        include: {
          operatorPermissions: true
        }
      });

      if (!employee) {
        return NextResponse.json(
          { error: "Employee not found" },
          { status: 404 }
        );
      }

      // Verify this is an operator
      if (employee.role !== UserRole.EMPLOYEE || employee.subrole !== EmployeeSubrole.OPERATOR) {
        return NextResponse.json(
          { error: "This user is not an operator" },
          { status: 400 }
        );
      }

      // For ADMIN role, check if they created this employee
      if (userRole === UserRole.ADMIN) {
        if (employee.createdById !== userId) {
          // Check if admin created any company user linked to this employee
          const employeeCompany = await prisma.user.findFirst({
            where: {
              id: employee.companyId || "",
              createdById: userId
            }
          });
          
          if (!employeeCompany) {
            return NextResponse.json(
              { error: "You do not have permission to modify this operator's permissions" },
              { status: 403 }
            );
          }
        }
      }

      // Update or create permissions
      let updatedPermissions;
      
      if (employee.operatorPermissions) {
        // Update existing permissions
        updatedPermissions = await prisma.operatorPermissions.update({
          where: { userId: employeeId },
          data: {
            canCreate: permissions.canCreate,
            canModify: permissions.canModify,
            canDelete: permissions.canDelete,
          }
        });
      } else {
        // Create new permissions
        updatedPermissions = await prisma.operatorPermissions.create({
          data: {
            userId: employeeId,
            canCreate: permissions.canCreate,
            canModify: permissions.canModify,
            canDelete: permissions.canDelete,
          }
        });
      }

      // Log the activity
      await addActivityLog({
        userId,
        action: ActivityAction.UPDATE,
        details: {
          entityType: "OPERATOR_PERMISSIONS",
          permissions: updatedPermissions
        },
        targetUserId: employeeId,
        targetResourceType: "operator_permissions"
      });

      return NextResponse.json(updatedPermissions);
    } catch (error) {
      console.error("Error updating operator permissions:", error);
      return NextResponse.json(
        { error: "Failed to update operator permissions" },
        { status: 500 }
      );
    }
  },
  [UserRole.ADMIN, UserRole.SUPERADMIN]
); 
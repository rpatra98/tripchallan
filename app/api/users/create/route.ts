// Using any type as a fallback to avoid TypeScript errors
// @ts-ignore
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole, EmployeeSubrole, ActivityAction } from "@/prisma/enums";
import { hash } from "bcrypt";
import { addActivityLog } from "@/lib/activity-logger";

// Generate a random password with 12 characters
function generateRandomPassword(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      const body = await req.json();
      
      // Log the request body for debugging
      console.log("Create user request body:", JSON.stringify(body, null, 2));
      
      // Validate required fields
      if (!body.email || !body.name || !body.role) {
        return NextResponse.json(
          { error: "Email, name, and role are required" },
          { status: 400 }
        );
      }
      
      // Get user role and company ID
      const userRole = session?.user.role;
      const userId = session?.user.id;
      
      // Only SuperAdmin and Admin can create users
      if (userRole !== UserRole.SUPERADMIN && userRole !== UserRole.ADMIN) {
        return NextResponse.json(
          { error: "Unauthorized. Only SuperAdmin and Admin can create users" },
          { status: 403 }
        );
      }
      
      // Validate role hierarchy
      if (userRole === UserRole.ADMIN) {
        // Admin can create COMPANY and EMPLOYEE users, but not other admins
        if (body.role !== UserRole.COMPANY && body.role !== UserRole.EMPLOYEE) {
          return NextResponse.json(
            { error: "Admin can only create COMPANY and EMPLOYEE users" },
            { status: 403 }
          );
        }
      }
      
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: body.email }
      });
      
      if (existingUser) {
        return NextResponse.json(
          { error: "User with this email already exists" },
          { status: 400 }
        );
      }
      
      // Use the provided password or generate a random one
      const password = body.password || generateRandomPassword();
      
      // Hash the password
      const hashedPassword = await hash(password, 12);
      
      // Create user with role-specific data
      let newUser;
      
      // For COMPANY role, create the company first then the user
      if (body.role === UserRole.COMPANY) {
        try {
          // First create the company
          const company = await prisma.company.create({
            data: {
              name: body.companyName || body.name,
              email: body.email,
              address: body.companyAddress || "",
              phone: body.companyPhone || "",
            }
          });
          
          // Then create the user with company reference
          newUser = await prisma.user.create({
            data: {
              email: body.email,
              name: body.name,
              password: hashedPassword,
              role: body.role,
              createdById: userId,
              companyId: company.id
            },
            include: {
              company: true
            }
          });
        } catch (err) {
          console.error("Error creating company:", err);
          throw new Error(`Company creation failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      } 
      // For EMPLOYEE role
      else if (body.role === UserRole.EMPLOYEE) {
        if (!body.companyId) {
          return NextResponse.json(
            { error: "Company ID is required for employee creation" },
            { status: 400 }
          );
        }
        
        // Verify company exists and is created by this admin if the creator is an ADMIN
        if (userRole === UserRole.ADMIN) {
          console.log(`Checking company ID: ${body.companyId}`);
          
          let isAuthorized = false;
          let companyId = body.companyId;
          
          // First, check if the ID is a Company User ID
          const companyUser = await prisma.user.findFirst({
            where: {
              id: body.companyId,
              role: UserRole.COMPANY,
            },
            include: {
              company: true
            }
          });
          
          console.log("Company user lookup result:", companyUser ? "Found" : "Not found", 
                      "Admin ID:", userId);
          
          // Check if companyUser exists and was created by this admin
          if (companyUser && companyUser.createdById === userId && companyUser.companyId) {
            isAuthorized = true;
            companyId = companyUser.companyId;
          } 
          
          // If not authorized yet, check if this is a direct Company ID
          if (!isAuthorized) {
            const directCompany = await prisma.company.findUnique({
              where: { id: body.companyId }
            });
            
            if (directCompany) {
              // Check if the admin created any users linked to this company
              const adminCreatedCompanyUsers = await prisma.user.findFirst({
                where: {
                  companyId: directCompany.id,
                  createdById: userId,
                }
              });
              
              if (adminCreatedCompanyUsers) {
                isAuthorized = true;
                companyId = directCompany.id;
              }
            }
          }
          
          // Final fallback - check for any custom permission mechanisms
          if (!isAuthorized) {
            try {
              // Check custom_permissions table if it exists
              const customPermCheck = await prisma.$queryRaw`
                SELECT EXISTS (
                  SELECT 1 FROM information_schema.tables 
                  WHERE table_name = 'custom_permissions'
                )`;
                
              if (customPermCheck && customPermCheck[0] && customPermCheck[0].exists) {
                const customPerm = await prisma.$queryRaw`
                  SELECT * FROM custom_permissions 
                  WHERE permission_type = 'ADMIN_COMPANY' 
                  AND user_id = ${userId} 
                  AND resource_id = ${body.companyId}`;
                  
                if (customPerm && customPerm.length > 0) {
                  isAuthorized = true;
                }
              }
            } catch (err) {
              console.error("Error checking custom permissions:", err);
              // Continue without failing - just log the error
            }
          }
          
          // If still not authorized, reject the request
          if (!isAuthorized) {
            return NextResponse.json(
              { error: "You are not authorized to add employees to this company" },
              { status: 403 }
            );
          }
          
          // Update company ID to the actual company ID (not user ID)
          body.companyId = companyId;
        }
        
        // Create the employee user
        newUser = await prisma.user.create({
          data: {
            email: body.email,
            name: body.name,
            password: hashedPassword,
            role: body.role,
            createdById: userId,
            companyId: body.companyId,
            subrole: body.subrole || EmployeeSubrole.OPERATOR,
            coins: body.coins || 0
          },
          include: {
            company: true
          }
        });

        // If this is an operator, create permissions
        // IMPORTANT: These permissions determine what actions the operator can perform with sessions/trips
        // They control the ability to create, modify, and delete trips which is critical for security
        if (body.subrole === EmployeeSubrole.OPERATOR) {
          try {
            // Validate that permissions are present for operators
            if (!body.permissions) {
              console.warn("No permissions provided for operator, using defaults");
              body.permissions = {
                canCreate: true,
                canModify: false,
                canDelete: false
              };
            }
            
            // Validate each permission field exists
            const permissionsToCreate = {
              userId: newUser.id,
              canCreate: body.permissions.canCreate !== undefined ? body.permissions.canCreate : true,
              canModify: body.permissions.canModify !== undefined ? body.permissions.canModify : false,
              canDelete: body.permissions.canDelete !== undefined ? body.permissions.canDelete : false,
            };
            
            // Create the permissions in the database
            const createdPermissions = await prisma.operatorPermissions.create({
              data: permissionsToCreate
            });
            
            console.log(`Created operator permissions for user ${newUser.id}:`, JSON.stringify(createdPermissions));
          } catch (err) {
            console.error("Error creating operator permissions:", err);
            // Don't fail the whole request if permissions creation fails
            // We'll just use the defaults, but log the error for debugging
            console.error("Failed to create permissions for operator. User ID:", newUser.id);
          }
        }
      } 
      // For other roles (SuperAdmin, Admin)
      else {
        newUser = await prisma.user.create({
          data: {
            email: body.email,
            name: body.name,
            password: hashedPassword,
            role: body.role,
            createdById: userId,
            coins: body.coins || 0
          }
        });
      }
      
      // Log the activity
      await addActivityLog({
        userId: userId as string,
        action: ActivityAction.CREATE,
        details: {
          entityType: "USER",
          userId: newUser.id,
          userRole: newUser.role,
          userEmail: newUser.email,
          // Include operator permissions in the activity log if this is an operator
          ...(body.subrole === EmployeeSubrole.OPERATOR && body.permissions 
            ? { 
                subrole: body.subrole,
                operatorPermissions: body.permissions 
              } 
            : {})
        },
        targetResourceId: newUser.id,
        targetResourceType: "USER"
      });
      
      // Return success with the generated password
      return NextResponse.json({
        success: true,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          company: newUser.company,
          coins: newUser.coins,
          permissions: body.subrole === EmployeeSubrole.OPERATOR ? body.permissions : undefined
        },
        password // Include the generated password in the response
      });
    } catch (error) {
      console.error("Error creating user:", error);
      
      // Extract more detailed error information
      let errorMessage = "Failed to create user";
      let errorDetails = "";
      
      if (error instanceof Error) {
        errorMessage = `Failed to create user: ${error.message}`;
        errorDetails = error.stack || "";
      }
      
      // Log the full error details for server debugging
      console.error("Detailed error:", errorDetails);
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN]
); 
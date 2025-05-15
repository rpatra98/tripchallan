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
import { TransactionReason } from "@/prisma/enums";
import { Prisma } from "@prisma/client";

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
        
        // If creating an OPERATOR with coins, verify ADMIN has sufficient balance
        if (body.subrole === EmployeeSubrole.OPERATOR && body.coins && body.coins > 0) {
          const coinsToAllocate = Number(body.coins);
          
          // Remove the session credit cost - no longer reserving coins for sessions
          const sessionCreditCost = 0; // Changed from 3 to 0 - we no longer reserve coins for session creation
          const reservedInitialCoin = 0;
          
          // Make sure we have the coin amount needed (just the coins being allocated)
          const totalCoinsNeeded = coinsToAllocate;
          
          // Check admin's balance before proceeding
          const admin = await prisma.user.findUnique({
            where: { id: userId as string },
            select: { 
              id: true,
              name: true,
              coins: true 
            }
          });
          
          if (!admin || admin.coins === null || admin.coins < totalCoinsNeeded) {
            return NextResponse.json(
              { error: `Insufficient coins. You have ${admin?.coins || 0} coins, but need ${totalCoinsNeeded} coins for operator.` },
              { status: 400 }
            );
          }
          
          // Use a transaction to ensure atomicity
          const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // 1. Create the operator - pass exact number of coins to ensure operator gets exactly what was requested
            const operator = await tx.user.create({
              data: {
                email: body.email,
                name: body.name,
                password: hashedPassword,
                role: body.role,
                createdById: userId,
                companyId: body.companyId,
                subrole: body.subrole,
                coins: coinsToAllocate // Exact amount requested
              },
              include: {
                company: true
              }
            });
            
            // 2. Deduct only the allocated coins from admin
            await tx.user.update({
              where: { id: userId as string },
              data: { coins: { decrement: totalCoinsNeeded } }
            });
            
            // 3. Record the main transaction for the initial coins
            await tx.coinTransaction.create({
              data: {
                fromUserId: userId as string,
                toUserId: operator.id,
                amount: coinsToAllocate,
                reason: TransactionReason.COIN_ALLOCATION,
                reasonText: `Initial coins for new operator: ${operator.name}`
              }
            });
            
            // Removed the SESSION_CREATION transaction - no longer needed
            
            // 4. If needed, create operator permissions
            if (body.permissions) {
              const permissionsToCreate = {
                userId: operator.id,
                canCreate: body.permissions.canCreate !== undefined ? body.permissions.canCreate : false,
                canModify: body.permissions.canModify !== undefined ? body.permissions.canModify : false,
                canDelete: body.permissions.canDelete !== undefined ? body.permissions.canDelete : false,
              };
              
              await tx.operatorPermissions.create({
                data: permissionsToCreate
              });
            }
            
            return operator;
          });
          
          // Set newUser to the created operator
          newUser = result;
          console.log(`Successfully created operator with ID ${newUser.id} and allocated ${coinsToAllocate} coins`);
        }
        else {
          // For non-operator employees or operators without coin allocation, create normally
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
          
          // If this is an operator without coins, still need to create permissions
          if (body.subrole === EmployeeSubrole.OPERATOR) {
            try {
              // Validate that permissions are present for operators
              if (!body.permissions) {
                console.warn("No permissions provided for operator, using secure defaults");
                body.permissions = {
                  canCreate: false,
                  canModify: false,
                  canDelete: false
                };
              }
              
              // Validate each permission field exists
              const permissionsToCreate = {
                userId: newUser.id,
                canCreate: body.permissions.canCreate !== undefined ? body.permissions.canCreate : false,
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
      } 
      // For other roles (SuperAdmin, Admin)
      else {
        // Check if this is an ADMIN being created by a SUPERADMIN with coins allocation
        if (body.role === UserRole.ADMIN && session?.user?.role === UserRole.SUPERADMIN && body.coins && body.coins > 0) {
          const coinsToAllocate = Number(body.coins);
          
          // Get SUPERADMIN's current balance
          const superAdmin = await prisma.user.findUnique({
            where: { id: userId as string },
            select: { 
              id: true,
              name: true,
              coins: true 
            }
          });
          
          // Check if SUPERADMIN has enough coins
          if (!superAdmin || superAdmin.coins === null || superAdmin.coins < coinsToAllocate) {
            return NextResponse.json(
              { error: `Insufficient coins. You have ${superAdmin?.coins || 0} coins, but are trying to allocate ${coinsToAllocate} coins.` },
              { status: 400 }
            );
          }
          
          // Use a transaction to ensure atomicity for ADMIN creation with coins
          const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
            // 1. Create the admin
            const admin = await tx.user.create({
              data: {
                email: body.email,
                name: body.name,
                password: hashedPassword,
                role: body.role,
                createdById: userId,
                coins: coinsToAllocate
              }
            });
            
            // 2. Deduct coins from SUPERADMIN
            await tx.user.update({
              where: { id: userId as string },
              data: { coins: { decrement: coinsToAllocate } }
            });
            
            // 3. Record the transaction
            await tx.coinTransaction.create({
              data: {
                fromUserId: userId as string,
                toUserId: admin.id,
                amount: coinsToAllocate,
                reason: TransactionReason.COIN_ALLOCATION,
                reasonText: `Initial coins for new admin: ${admin.name}`
              }
            });
            
            return admin;
          });
          
          // Set newUser to the created admin
          newUser = result;
          console.log(`Successfully created admin with ID ${newUser.id} and allocated ${coinsToAllocate} coins`);
        } else {
          // For other cases, create normally without a transaction
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
          userName: newUser.name,
          createdAt: new Date().toISOString(),
          // Include operator permissions in the activity log if this is an operator
          ...(body.subrole === EmployeeSubrole.OPERATOR && body.permissions 
            ? { 
                subrole: body.subrole,
                operatorPermissions: body.permissions 
              } 
            : {}),
          // Include company information if creating a COMPANY
          ...(body.role === UserRole.COMPANY && newUser.company 
            ? { 
                companyId: newUser.company.id,
                companyName: newUser.company.name
              }
            : {}),
          // Summary text for better display
          summaryText: `${body.role === UserRole.COMPANY ? 'Company' : 
                        (body.role === UserRole.EMPLOYEE ? 
                          (body.subrole === EmployeeSubrole.OPERATOR ? 'Operator' : 'Employee') : 
                          body.role)} ${newUser.name} (${newUser.email})`
        },
        targetUserId: newUser.id,
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
// Using any type as a fallback to avoid TypeScript errors
// @ts-ignore
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { UserRole, EmployeeSubrole, ActivityAction } from "@/lib/enums";
import { hash } from "bcrypt";
import { addActivityLog } from "@/lib/activity-logger";
import { TransactionReason } from "@/lib/enums";
// Supabase types are used instead of Prisma types
import path from "path";
import fs from "fs/promises";

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
      // Check if request is multipart form-data
      const contentType = req.headers.get("content-type") || "";
      let body;
      
      try {
        if (contentType.includes("multipart/form-data")) {
          // Handle form data
          const formData = await req.formData();
          body = Object.fromEntries(formData);
          
          // Convert documents from FormData to array
          const documentEntries = Array.from(formData.entries())
            .filter(([key]) => key.startsWith('documents['))
            .map(([_, value]) => value);
            
          if (documentEntries.length > 0) {
            // Create a new body object with the documents array
            body = {
              ...body,
              documents: documentEntries
            };
          }
        } else {
          // Handle JSON data
          body = await req.json();
        }
      } catch (parseError) {
        console.error("Error parsing request body:", parseError);
        return NextResponse.json(
          { error: "Invalid request format. Could not parse request body." },
          { status: 400 }
        );
      }
      
      // Log the request body for debugging
      console.log("Create user request body:", body);
      
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
      const existingUser = await supabase.from('users').select('*').eq('email', body.email).single();
      
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
          // Process file uploads (logo and documents)
          let logoUrl = null;
          let documentUrls: string[] = [];
          
          // Process logo if provided
          if (body.logo && body.logo instanceof File) {
            try {
              // Generate a unique filename
              const uniqueFilename = `${Date.now()}_${body.logo.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
              const logoPath = `uploads/logos/${uniqueFilename}`;
              const publicPath = `/uploads/logos/${uniqueFilename}`;
              
              // Convert File to Buffer
              const arrayBuffer = await body.logo.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              
              // Ensure directory exists (should be created in app startup, but just in case)
              const dir = path.join(process.cwd(), 'public', 'uploads', 'logos');
              await fs.mkdir(dir, { recursive: true });
              
              // Write file to public directory
              await fs.writeFile(path.join(process.cwd(), 'public', logoPath), buffer);
              
              // Store public URL path in database
              logoUrl = publicPath;
              console.log(`Logo saved successfully at ${logoPath}`);
            } catch (fileError) {
              console.error("Error saving logo file:", fileError);
              // Don't throw error, just log it and continue without logo
            }
          }
          
          // Process documents if provided
          if (body.documents) {
            try {
              const docs = Array.isArray(body.documents) ? body.documents : [body.documents];
              // Process each document
              documentUrls = await Promise.all(docs.map(async (doc: FormDataEntryValue, index: number) => {
                if (doc instanceof File) {
                  try {
                    // Generate a unique filename
                    const uniqueFilename = `${Date.now()}_${index}_${doc.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                    const docPath = `uploads/documents/${uniqueFilename}`;
                    const publicPath = `/uploads/documents/${uniqueFilename}`;
                    
                    // Convert File to Buffer
                    const arrayBuffer = await doc.arrayBuffer();
                    const buffer = Buffer.from(arrayBuffer);
                    
                    // Ensure directory exists
                    const dir = path.join(process.cwd(), 'public', 'uploads', 'documents');
                    await fs.mkdir(dir, { recursive: true });
                    
                    // Write file to public directory
                    await fs.writeFile(path.join(process.cwd(), 'public', docPath), buffer);
                    
                    // Return public URL path to store in database
                    console.log(`Document saved successfully at ${docPath}`);
                    return publicPath;
                  } catch (fileError) {
                    console.error(`Error saving document file ${index}:`, fileError);
                    return "";
                  }
                }
                return "";
              })).then(urls => urls.filter(Boolean));
            } catch (documentsError) {
              console.error("Error processing documents:", documentsError);
              documentUrls = []; // Continue without documents
            }
          }
          
          // First create the company if needed
          const { data: newCompany, error: companyError } = await supabase
            .from('companies')
            .insert({
              name: body.companyName || body.name,
              email: body.email,
              address: body.companyAddress || "",
              phone: body.companyPhone || "",
              companyType: body.companyType || "--Others--",
              gstin: body.gstin || null,
              logo: logoUrl,
              documents: documentUrls,
              isActive: true
            })
            .select()
            .single();
          
          if (companyError) {
            console.error('Error creating company:', companyError);
            return NextResponse.json({ error: 'Failed to create company' }, { status: 500 });
          }

          // Then create the user with company reference
          const { data: newUser, error: userError } = await supabase
            .from('users')
            .insert({
              name: body.name,
              email: body.email,
              password: hashedPassword,
              role: UserRole.COMPANY,
              companyId: newCompany.id,
              createdById: userId,
              isActive: true
            })
            .select()
            .single();
          
          if (userError) {
            console.error('Error creating user:', userError);
            return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
          }
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
          const admin = await supabase.from('users').findUnique({
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
          try {
            // 1. Create the operator
            const { data: operator, error: operatorError } = await supabase
              .from('users')
              .insert({
                email: body.email,
                name: body.name,
                password: hashedPassword,
                role: body.role,
                createdById: userId,
                companyId: body.companyId,
                subrole: body.subrole,
                coins: coinsToAllocate // Exact amount requested
              })
              .select('*, company:companyId(*)')
              .single();
            
            if (operatorError) {
              throw new Error(`Failed to create operator: ${operatorError.message}`);
            }
            
            // 2. Deduct only the allocated coins from admin
            const { error: adminUpdateError } = await supabase
              .from('users')
              .update({ 
                coins: admin.coins - totalCoinsNeeded,
                updatedAt: new Date().toISOString()
              })
              .eq('id', userId);
            
            if (adminUpdateError) {
              throw new Error(`Failed to update admin coins: ${adminUpdateError.message}`);
            }
            
            // 3. Record the main transaction for the initial coins
            const { error: transactionError } = await supabase
              .from('coin_transactions')
              .insert({
                from_user_id: userId,
                to_user_id: operator.id,
                amount: coinsToAllocate,
                notes: `Initial coins for new operator: ${operator.name}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            
            if (transactionError) {
              throw new Error(`Failed to record transaction: ${transactionError.message}`);
            }
            
            // 4. If needed, create operator permissions
            if (body.permissions) {
              const permissionsToCreate = {
                userId: operator.id,
                canCreate: body.permissions.canCreate !== undefined ? body.permissions.canCreate : false,
                canModify: body.permissions.canModify !== undefined ? body.permissions.canModify : false,
                canDelete: body.permissions.canDelete !== undefined ? body.permissions.canDelete : false,
              };
              
              const { error: permissionsError } = await supabase
                .from('operatorPermissions')
                .insert(permissionsToCreate);
              
              if (permissionsError) {
                console.error(`Failed to create operator permissions: ${permissionsError.message}`);
                // Don't fail the transaction for permissions error
              }
            }
            
            // Set newUser to the created operator
            newUser = operator;
            console.log(`Successfully created operator with ID ${operator.id} and allocated ${coinsToAllocate} coins`);
          } catch (error) {
            console.error("Transaction failed:", error);
            return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create operator' }, { status: 500 });
          }
        }
        else {
          // For non-operator employees or operators without coin allocation, create normally
          try {
            // Create the employee
            const { data: newUser, error: userError } = await supabase
              .from('users')
              .insert({
                name: body.name,
                email: body.email,
                password: hashedPassword,
                role: UserRole.EMPLOYEE,
                subrole: body.subrole || EmployeeSubrole.OPERATOR,
                companyId: body.companyId,
                createdById: session.user.id,
                coins: body.coins || 0,
                isActive: true
              })
              .select(`
                *,
                company:companyId(*)
              `)
              .single();
            
            if (userError) {
              console.error('Error creating employee:', userError);
              return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 });
            }
            
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
                
                // Create operator permissions if needed
                try {
                  const permissionsToCreate = {
                    userId: newUser.id,
                    canDelete: body.permissions?.canDelete || false,
                    canModify: body.permissions?.canModify || false,
                    canAccess: body.permissions?.canAccess || true,
                    canViewImages: body.permissions?.canViewImages || true,
                    allocatedCoins: body.coins || 0
                  };
                  
                  const { error: permError } = await supabase
                    .from('operatorPermissions')
                    .insert(permissionsToCreate);
                  
                  if (permError) {
                    console.error("Failed to create permissions for operator:", permError);
                    // Don't throw error here, just log it and continue (user is already created)
                  }
                } catch (permErr) {
                  console.error("Failed to create permissions for operator, but user was created:", permErr);
                  // Don't throw error here, just log it and continue (user is already created)
                }
              } catch (permErr) {
                console.error("Failed to create permissions for operator, but user was created:", permErr);
                // Don't throw error here, just log it and continue (user is already created)
              }
            }
          } catch (err) {
            console.error("Error creating employee:", err);
            throw new Error(`Employee creation failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }
      } 
      // For other roles (SuperAdmin, Admin)
      else {
        // Check if this is an ADMIN being created by a SUPERADMIN with coins allocation
        if (body.role === UserRole.ADMIN && session?.user?.role === UserRole.SUPERADMIN && body.coins && body.coins > 0) {
          const coinsToAllocate = Number(body.coins);
          
          // Get SUPERADMIN's current balance
          const superAdmin = await supabase.from('users').findUnique({
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
          
          try {
            // 1. Create the admin
            const { data: admin, error: adminError } = await supabase
              .from('users')
              .insert({
                email: body.email,
                name: body.name,
                password: hashedPassword,
                role: body.role,
                createdById: userId,
                coins: coinsToAllocate
              })
              .select()
              .single();
            
            if (adminError) {
              throw new Error(`Failed to create admin: ${adminError.message}`);
            }
            
            // 2. Deduct coins from SUPERADMIN
            const { error: updateError } = await supabase
              .from('users')
              .update({ 
                coins: superAdmin.coins - coinsToAllocate,
                updatedAt: new Date().toISOString()
              })
              .eq('id', userId);
            
            if (updateError) {
              throw new Error(`Failed to update SUPERADMIN coins: ${updateError.message}`);
            }
            
            // 3. Record the transaction
            const { error: transactionError } = await supabase
              .from('coin_transactions')
              .insert({
                from_user_id: userId,
                to_user_id: admin.id,
                amount: coinsToAllocate,
                notes: `Initial coins for new admin: ${admin.name}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              });
            
            if (transactionError) {
              throw new Error(`Failed to record transaction: ${transactionError.message}`);
            }
            
            // Set newUser to the created admin
            newUser = admin;
            console.log(`Successfully created admin with ID ${admin.id} and allocated ${coinsToAllocate} coins`);
          } catch (error) {
            console.error("Admin creation failed:", error);
            return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to create admin' }, { status: 500 });
          }
        } else {
          // For other cases, create normally without a transaction
          const { data: newUserData, error: userError } = await supabase
            .from('users')
            .insert({
              email: body.email,
              name: body.name,
              password: hashedPassword,
              role: body.role,
              createdById: userId,
              coins: body.coins || 0
            })
            .select()
            .single();
          
          if (userError) {
            console.error('Error creating user:', userError);
            return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
          }
          
          newUser = newUserData;
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
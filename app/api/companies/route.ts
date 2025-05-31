// Using any type as a fallback to avoid TypeScript errors
// @ts-ignore
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import prismaHelper from "@/lib/prisma-helper";
import { UserRole } from "@/lib/enums";

// Define the company type
interface Company {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  isActive?: boolean;
}

async function handler() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the current user's details
    const currentUser = await prismaHelper.executePrismaWithRetry(async () => {
      return supabase.from('users').findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true }
      });
    });

    if (!currentUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Different query based on user role
    let companies: Company[] = [];
    
    // SUPERADMIN can see all companies
    if (currentUser.role === UserRole.SUPERADMIN) {
      companies = await prismaHelper.executePrismaWithRetry(async () => {
        return supabase.from('companys').select('*').{
          select: {
            id: true,
            name: true,
            email: true,
            createdAt: true,
            updatedAt: true,
            isActive: true,
          },
          orderBy: { name: "asc" },
        });
      });
    } 
    // ADMIN should only see companies they created
    else if (currentUser.role === UserRole.ADMIN) {
      // Find companies created by this admin
      const companyUsers = await prismaHelper.executePrismaWithRetry(async () => {
        return supabase.from('users').select('*').{
          where: {
            role: UserRole.COMPANY,
            createdById: currentUser.id,
          },
          select: {
            id: true,
            companyId: true,
          }
        });
      });
      
      // Get the company IDs associated with these users
      const companyIds = companyUsers
        .filter((user: any) => user.companyId)
        .map((user: any) => user.companyId as string);
      
      // Also find companies where the admin has created any users
      const adminEmployeeCreations = await prismaHelper.executePrismaWithRetry(async () => {
        return supabase.from('users').select('*').{
          where: {
            role: UserRole.EMPLOYEE,
            createdById: currentUser.id,
            NOT: {
              companyId: null
            }
          },
          select: {
            companyId: true
          },
          distinct: ['companyId']
        });
      });
      
      // Add company IDs from employee creation relationships
      const employeeCompanyIds = adminEmployeeCreations
        .filter((user: any) => user.companyId)
        .map((user: any) => user.companyId as string);
      
      // Combine both sets of company IDs without duplicates
      const uniqueCompanyIds = [...new Set([...companyIds, ...employeeCompanyIds])];
      
      // Also check for custom permissions if that table exists
      try {
        const customPermCheck = await prismaHelper.executePrismaWithRetry(async () => {
          return prisma.$queryRaw`
            SELECT EXISTS (
              SELECT 1 FROM information_schema.tables 
              WHERE table_name = 'custom_permissions'
            )`;
        });
          
        if (customPermCheck && customPermCheck[0] && customPermCheck[0].exists) {
          const customPerms = await prismaHelper.executePrismaWithRetry(async () => {
            return prisma.$queryRaw`
              SELECT resource_id FROM custom_permissions 
              WHERE permission_type = 'ADMIN_COMPANY' 
              AND user_id = ${currentUser.id}`;
          });
            
          if (customPerms && customPerms.length > 0) {
            // Add these company IDs to the list
            customPerms.forEach((perm: any) => {
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
      if (uniqueCompanyIds.length > 0) {
        companies = await prismaHelper.executePrismaWithRetry(async () => {
          return supabase.from('companys').select('*').{
            where: {
              id: {
                in: uniqueCompanyIds
              }
            },
            select: {
              id: true,
              name: true,
              email: true,
              createdAt: true,
              updatedAt: true,
              isActive: true,
            },
            orderBy: { name: "asc" },
          });
        });
      }
    } 
    // Other roles (like COMPANY) should see only their company
    else {
      if (currentUser.role === UserRole.COMPANY) {
        const companyUser = await prismaHelper.executePrismaWithRetry(async () => {
          return supabase.from('users').findUnique({
            where: { id: currentUser.id },
            select: { companyId: true }
          });
        });
        
        if (companyUser?.companyId) {
          const company = await prismaHelper.executePrismaWithRetry(async () => {
            return supabase.from('companys').findUnique({
              where: { id: companyUser.companyId },
              select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
                updatedAt: true,
                isActive: true,
              }
            });
          });
          
          if (company) {
            companies = [company];
          }
        }
      }
    }

    // Find company users and add them to the company data
    const companiesWithUsers = await Promise.all(
      companies.map(async (company) => {
        // Find the company user
        const companyUser = await prismaHelper.executePrismaWithRetry(async () => {
          return supabase.from('users').findFirst({
            where: {
              companyId: company.id,
              role: UserRole.COMPANY,
            },
            select: {
              id: true,
            },
          });
        });

        // Count employees for this company
        const employeeCount = await prismaHelper.executePrismaWithRetry(async () => {
          return supabase.from('users').count({
            where: {
              companyId: company.id,
              role: UserRole.EMPLOYEE,
            }
          });
        });

        return {
          id: company.id, // The actual company ID from the companies table
          companyUserId: companyUser?.id, // The User ID with role=COMPANY - important for links
          name: company.name,
          email: company.email,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt,
          isActive: company.isActive, // Include isActive field in the response
          _count: {
            employees: employeeCount
          }
        };
      })
    );

    return NextResponse.json(companiesWithUsers);
  } catch (error) {
    console.error("Error fetching companies:", error);
    
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
      { error: "Failed to fetch companies", details: errorMessage },
      { status: 500 }
    );
  }
}

// Admin, SuperAdmin, and Employees can view the list of companies
export const GET = withAuth(handler, [
  UserRole.ADMIN,
  UserRole.SUPERADMIN,
  UserRole.EMPLOYEE,
  UserRole.COMPANY
]); 
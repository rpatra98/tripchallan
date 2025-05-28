import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { EmployeeSubrole, UserRole } from "@/prisma/enums";

interface Company {
  id: string;
  name: string;
  email: string;
}

async function handler(
  req: NextRequest,
  context?: { params: Record<string, string> }
) {
  console.log("🔍 Fetching sessions for admin");
  
  try {
    if (!context || !context.params.id) {
      return NextResponse.json(
        { error: "Admin ID is required" },
        { status: 400 }
      );
    }

    const adminId = context.params.id;
    console.log(`🔍 Admin ID: ${adminId}`);

    // Get pagination parameters from query
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;
    
    // Get status filter if provided
    const statusFilter = url.searchParams.get("status");

    // Get the admin user to check their role
    const adminUser = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true }
    });
    
    const isSuperAdmin = adminUser?.role === UserRole.SUPERADMIN;
    console.log(`🔍 Admin is SUPERADMIN: ${isSuperAdmin}`);

    // Get all company IDs from different sources
    const companyIds = new Set<string>();
    // Get operator IDs created by this admin
    const operatorIds = new Set<string>();
    
    // Source 1: Companies created by this admin
    const createdCompanies = await prisma.user.findMany({
      where: {
        role: UserRole.COMPANY,
        createdById: adminId,
      },
      select: {
        id: true,
        name: true,
        email: true
      },
    });
    
    createdCompanies.forEach((company: Company) => companyIds.add(company.id));
    console.log(`🔍 Found ${createdCompanies.length} companies created by admin`);
    
    // Source 2: Companies the admin has access to via custom permissions
    try {
      const customPermissions = await prisma.custom_permissions.findMany({
        where: {
          userId: adminId,
          resourceType: "COMPANY",
        },
        select: {
          resourceId: true,
        },
      });
      
      customPermissions.forEach((permission: { resourceId?: string }) => {
        if (permission.resourceId) companyIds.add(permission.resourceId);
      });
      console.log(`🔍 Found ${customPermissions.length} custom permission entries`);
    } catch (error) {
      console.log("Custom permissions table may not exist or other error:", error);
      // Continue if the table doesn't exist
    }
    
    // Source 3: Companies where the admin created employees
    try {
      const companiesWithEmployees = await prisma.user.findMany({
        where: {
          role: {
            in: [UserRole.EMPLOYEE, "GUARD"]
          },
          createdById: adminId,
        },
        select: {
          companyId: true
        },
        distinct: ['companyId']
      });
      
      companiesWithEmployees.forEach((item: { companyId?: string }) => {
        if (item.companyId) companyIds.add(item.companyId);
      });
      console.log(`🔍 Found ${companiesWithEmployees.length} companies with employees created by admin`);
    } catch (error) {
      console.log("Error fetching companies with employees:", error);
    }
    
    // Source 4: Find OPERATORS created by this admin
    try {
      const operatorsCreatedByAdmin = await prisma.user.findMany({
        where: {
          role: UserRole.EMPLOYEE,
          subrole: EmployeeSubrole.OPERATOR,
          createdById: adminId,
        },
        select: {
          id: true,
        }
      });
      
      operatorsCreatedByAdmin.forEach((operator: { id: string }) => {
        operatorIds.add(operator.id);
      });
      console.log(`🔍 Found ${operatorsCreatedByAdmin.length} OPERATORS created by admin`);
    } catch (error) {
      console.log("Error fetching operators created by admin:", error);
    }
    
    // Convert sets to arrays
    const companyIdsArray = Array.from(companyIds);
    const operatorIdsArray = Array.from(operatorIds);
    console.log(`🔍 Total unique companies: ${companyIdsArray.length}`);
    console.log(`🔍 Total unique operators: ${operatorIdsArray.length}`);

    // Define the where clause based on available data
    let whereClause: {
      OR?: Array<{ companyId?: { in: string[] }; createdById?: { in: string[] } }>;
      id?: string;
      status?: string;
    } = {};
    
    // Build the OR conditions
    const orConditions = [];
    
    // Condition 1: Sessions from companies created by admin
    if (companyIdsArray.length > 0) {
      orConditions.push({ companyId: { in: companyIdsArray } });
      console.log(`🔍 Adding filter for ${companyIdsArray.length} companies`);
    }
    
    // Condition 2: Sessions created by operators who were created by this admin
    if (operatorIdsArray.length > 0) {
      orConditions.push({ createdById: { in: operatorIdsArray } });
      console.log(`🔍 Adding filter for ${operatorIdsArray.length} operators`);
    }
    
    // If we have any OR conditions, add them to the where clause
    if (orConditions.length > 0) {
      whereClause.OR = orConditions;
    } else if (isSuperAdmin) {
      // For superadmin with no companies or operators, show all sessions 
      console.log("🔍 SUPERADMIN with no companies or operators, showing all sessions");
      whereClause = {}; // Empty where clause to show all
    } else {
      // If admin has no companies/operators, show no sessions
      console.log("🔍 Admin with no companies or operators, showing no sessions");
      whereClause.id = "non-existent-id"; // This ensures no results
    }

    // Add status filter if provided
    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    console.log(`🔍 Using where clause:`, JSON.stringify(whereClause));

    // Fetch sessions with pagination
    const sessions = await prisma.session.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            subrole: true,
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
        seal: {
          select: {
            id: true,
            barcode: true,
            verified: true,
            scannedAt: true,
          },
        },
      },
      where: whereClause
    });

    console.log(`🔍 Found ${sessions.length} sessions for admin`);

    // Get total count for pagination
    const totalCount = await prisma.session.count({
      where: whereClause
    });

    // For debugging - show some session details
    if (sessions.length > 0) {
      console.log(`🔍 First session - ID: ${sessions[0].id}, Company: ${sessions[0].company?.name || 'Unknown'}`);
      console.log(`🔍 Created by: ${sessions[0].createdBy?.name}, Subrole: ${sessions[0].createdBy?.subrole}`);
    }

    return NextResponse.json({
      sessions,
      totalCount,
      page,
      totalPages: Math.ceil(totalCount / limit),
      hasNextPage: page < Math.ceil(totalCount / limit),
      hasPrevPage: page > 1
    });
  } catch (error: unknown) {
    console.error("Error fetching admin sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch sessions" },
      { status: 500 }
    );
  }
}

// Only SuperAdmin can access admin details
export const GET = withAuth(handler, [UserRole.SUPERADMIN]); 
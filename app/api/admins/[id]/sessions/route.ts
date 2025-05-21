import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import { Prisma } from "@prisma/client";

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

    // Get all company IDs from different sources
    const companyIds = new Set<string>();
    
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
    
    // Source 4: Direct query for sessions created by this admin
    try {
      const sessionsCreatedByAdmin = await prisma.session.findMany({
        where: {
          createdById: adminId,
        },
        select: {
          companyId: true
        },
        distinct: ['companyId']
      });
      
      sessionsCreatedByAdmin.forEach((item: { companyId?: string }) => {
        if (item.companyId) companyIds.add(item.companyId);
      });
      console.log(`🔍 Found ${sessionsCreatedByAdmin.length} companies with sessions created by admin`);
    } catch (error) {
      console.log("Error fetching sessions created by admin:", error);
    }
    
    // Convert set to array
    const companyIdsArray = Array.from(companyIds);
    console.log(`🔍 Total unique companies: ${companyIdsArray.length}`);

    // If admin is SUPERADMIN, they should see all sessions (optional feature, disabled by default)
    const adminUser = await prisma.user.findUnique({
      where: { id: adminId },
      select: { role: true }
    });
    
    const isSuperAdmin = adminUser?.role === UserRole.SUPERADMIN;
    console.log(`🔍 Admin is SUPERADMIN: ${isSuperAdmin}`);
    
    // Define the where clause based on available data
    let whereClause: any = {};
    
    if (companyIdsArray.length > 0) {
      // Default case: Filter by companies
      whereClause.companyId = { in: companyIdsArray };
    } else {
      // Special case: No companies found but admin might have created sessions directly
      whereClause.OR = [
        { createdById: adminId }
      ];
      
      // Add dummy condition to prevent empty OR clause
      if (isSuperAdmin) {
        // For superadmin with no companies, show all sessions 
        console.log("🔍 SUPERADMIN with no companies, showing all sessions");
        whereClause = {}; // Empty where clause to show all
      } else {
        // Add impossible condition to avoid error but return no results
        console.log("🔍 Admin with no companies, showing no sessions");
        whereClause.id = "non-existent-id";
      }
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
            subrole: true
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
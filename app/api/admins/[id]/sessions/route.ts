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
  try {
    if (!context || !context.params.id) {
      return NextResponse.json(
        { error: "Admin ID is required" },
        { status: 400 }
      );
    }

    const adminId = context.params.id;

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
      
      customPermissions.forEach(permission => {
        if (permission.resourceId) companyIds.add(permission.resourceId);
      });
    } catch (error) {
      console.log("Custom permissions table may not exist or other error:", error);
      // Continue if the table doesn't exist
    }
    
    // Source 3: Companies where the admin created employees
    try {
      const companiesWithEmployees = await prisma.user.findMany({
        where: {
          role: {
            in: [UserRole.EMPLOYEE, UserRole.GUARD]
          },
          createdById: adminId,
        },
        select: {
          companyId: true
        },
        distinct: ['companyId']
      });
      
      companiesWithEmployees.forEach(item => {
        if (item.companyId) companyIds.add(item.companyId);
      });
    } catch (error) {
      console.log("Error fetching companies with employees:", error);
    }
    
    // Convert set to array
    const companyIdsArray = Array.from(companyIds);

    if (companyIdsArray.length === 0) {
      return NextResponse.json({
        sessions: [],
        totalCount: 0,
        page,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: false
      });
    }

    // Build where clause for sessions
    const whereClause: any = {
      companyId: { in: companyIdsArray }
    };

    // Add status filter if provided
    if (statusFilter) {
      whereClause.status = statusFilter;
    }

    // Fetch sessions for these companies with pagination
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

    // Get total count for pagination
    const totalCount = await prisma.session.count({
      where: whereClause
    });

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
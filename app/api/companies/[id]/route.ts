import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { UserRole } from "@/prisma/enums";
import { Prisma } from "@prisma/client";
import prismaHelper from "@/lib/prisma-helper";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    if (!id) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }

    // Additional validation for the ID format
    console.log(`API: Fetching company with ID: "${id}" - Length: ${id.length}`);
    
    // First, check if this is a direct company ID
    let company = await prismaHelper.findCompanyById(id, true);

    console.log(`API: Direct company lookup result:`, company ? "Found" : "Not Found");

    // If not found, this might be a User ID with role=COMPANY, so look it up that way
    if (!company) {
      const companyUser = await prismaHelper.findFirstUser({
        id,
        role: UserRole.COMPANY
      }, {
        id: true,
        name: true,
        email: true,
        companyId: true,
        coins: true,
        createdAt: true,
        updatedAt: true
      });

      console.log(`API: Company user lookup result:`, companyUser ? `Found with companyId: ${companyUser?.companyId || 'null'}` : "Not Found");

      // If we found a company user, get the actual company data if it has a companyId
      if (companyUser) {
        if (companyUser.companyId) {
          company = await prismaHelper.findCompanyById(companyUser.companyId, true);
            
          console.log(`API: Related company lookup result:`, company ? "Found" : "Not Found");
        }
        
        // If we still don't have a company record, create a synthetic one from the company user
        if (!company) {
          // Get employees for this company user
          const employees = await prismaHelper.findUsers({
            companyId: companyUser.id,
            role: UserRole.EMPLOYEE
          }, {
            id: true,
            name: true,
            email: true,
            role: true,
            subrole: true,
            coins: true,
            createdAt: true
          });
          
          // Create a synthetic company object from the user data
          company = {
            id: companyUser.id,
            name: companyUser.name,
            email: companyUser.email,
            createdAt: companyUser.createdAt,
            updatedAt: companyUser.updatedAt,
            isActive: true,
            coins: companyUser.coins,
            employees: employees,
            _synthetic: true
          };
          
          console.log(`API: Created synthetic company from user`);
        }
      }
    }
    
    // If we still have no company record, return an error
    if (!company) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }
    
    // Return the company data
    return NextResponse.json(company);
  } catch (error) {
    console.error("Error fetching company details:", error);
    return NextResponse.json(
      { 
        error: "Error fetching company details",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Only ADMIN and SUPERADMIN can update companies
    if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.SUPERADMIN) {
      return NextResponse.json(
        { error: "Only admins can update companies" },
        { status: 403 }
      );
    }
    
    if (!id) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }
    
    const body = await request.json();
    
    // Check if company exists
    let existingCompany = await prisma.company.findUnique({
      where: { id }
    });
    
    let companyId = id;
    
    // If not found directly, check if it's a company user
    if (!existingCompany) {
      console.log(`API PATCH: Company not found directly, checking if it's a company user`);
      
      const companyUser = await prisma.user.findFirst({
        where: {
          id,
          role: UserRole.COMPANY
        },
        select: {
          id: true,
          name: true,
          email: true,
          companyId: true
        }
      });
      
      // If this is a company user with a companyId, use that ID instead
      if (companyUser && companyUser.companyId) {
        console.log(`API PATCH: Found company user with companyId: ${companyUser.companyId}`);
        
        companyId = companyUser.companyId;
        existingCompany = await prisma.company.findUnique({
          where: { id: companyUser.companyId }
        });
      }
      
      // If still no company found, check if we need to create one from the company user
      if (!existingCompany && companyUser) {
        console.log(`API PATCH: Creating company record for company user`);
        
        // Create a real company record for this user
        existingCompany = await prisma.company.create({
          data: {
            name: companyUser.name || `Company for ${companyUser.id}`,
            email: companyUser.email || `company-${companyUser.id}@example.com`,
            isActive: body.isActive !== undefined ? body.isActive : true,
          }
        });
        
        companyId = existingCompany.id;
        
        // Link the company user to this new company
        await prisma.user.update({
          where: { id: companyUser.id },
          data: {
            companyId: existingCompany.id
          }
        });
        
        console.log(`API PATCH: Created company with ID: ${existingCompany.id} for user: ${companyUser.id}`);
        return NextResponse.json({
          message: "Company created and linked successfully",
          company: existingCompany
        });
      }
    }
    
    if (!existingCompany) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }
    
    // Update company
    const updatedCompany = await prisma.company.update({
      where: { id: companyId },
      data: {
        isActive: body.isActive !== undefined ? body.isActive : existingCompany.isActive,
        name: body.name || existingCompany.name,
        email: body.email || existingCompany.email,
        address: body.address !== undefined ? body.address : existingCompany.address,
        phone: body.phone !== undefined ? body.phone : existingCompany.phone,
        companyType: body.companyType || existingCompany.companyType,
        gstin: body.gstin !== undefined ? body.gstin : existingCompany.gstin,
        logo: body.logo !== undefined ? body.logo : existingCompany.logo,
        documents: body.documents !== undefined ? body.documents : existingCompany.documents,
      }
    });
    
    return NextResponse.json({
      message: "Company updated successfully",
      company: updatedCompany
    });
  } catch (error) {
    console.error("Error updating company:", error);
    return NextResponse.json(
      { error: "Failed to update company", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const session = await getServerSession(authOptions);
    
    // Check for confirmation in the request body
    const body = await request.json().catch(() => ({}));
    const confirmed = body.confirmed === true;
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    // Only ADMIN and SUPERADMIN can delete companies
    if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.SUPERADMIN) {
      return NextResponse.json(
        { error: "Only admins can delete companies" },
        { status: 403 }
      );
    }
    
    if (!id) {
      return NextResponse.json(
        { error: "Company ID is required" },
        { status: 400 }
      );
    }
    
    // Require confirmation for deletion
    if (!confirmed) {
      return NextResponse.json(
        { error: "Deletion requires confirmation" },
        { status: 400 }
      );
    }
    
    // Check if company exists directly
    let existingCompany = await prisma.company.findUnique({
      where: { id },
      include: {
        employees: true
      }
    });
    
    let companyUserId = null;
    let companyId = id;
    
    // If not found directly, check if it's a company user
    if (!existingCompany) {
      console.log(`API DELETE: Company not found directly, checking if it's a company user`);
      
      const companyUser = await prisma.user.findFirst({
        where: {
          id,
          role: UserRole.COMPANY
        },
        select: {
          id: true,
          companyId: true
        }
      });
      
      // If this is a company user with a companyId, use that ID instead
      if (companyUser) {
        companyUserId = companyUser.id;
        
        if (companyUser.companyId) {
          console.log(`API DELETE: Found company user with companyId: ${companyUser.companyId}`);
          
          companyId = companyUser.companyId;
          existingCompany = await prisma.company.findUnique({
            where: { id: companyUser.companyId },
            include: {
              employees: true
            }
          });
        }
      }
    }
    
    // If we still don't have a company, it doesn't exist
    if (!existingCompany && !companyUserId) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }
    
    // If we have a company user but no company, just delete the user
    if (!existingCompany && companyUserId) {
      console.log(`API DELETE: No company record found, deleting company user: ${companyUserId}`);
      
      // Use a transaction to ensure atomicity
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Delete all related employees
        await tx.user.deleteMany({
          where: {
            companyId: companyUserId
          }
        });
        
        // Delete the company user
        await tx.user.delete({
          where: { id: companyUserId }
        });
      });
      
      return NextResponse.json({
        message: "Company user deleted successfully"
      });
    }
    
    // Delete all company users (needed for referential integrity)
    const companyUsers = await prisma.user.findMany({
      where: {
        companyId: existingCompany!.id,
        role: UserRole.COMPANY
      }
    });
    
    // Use a transaction to ensure atomicity
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete all company employees
      await tx.user.deleteMany({
        where: {
          companyId: existingCompany!.id
        }
      });
      
      // Delete the company
      await tx.company.delete({
        where: { id: existingCompany!.id }
      });
    });
    
    return NextResponse.json({
      message: "Company deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting company:", error);
    return NextResponse.json(
      { error: "Failed to delete company", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 
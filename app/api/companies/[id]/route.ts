import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { UserRole } from "@/prisma/enums";
import { Prisma } from "@prisma/client";

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

    console.log(`API: Fetching company with ID: ${id}`);

    // First, check if this is a direct company ID
    let company = await prisma.company.findUnique({
      where: { id },
      include: {
        employees: {
          where: { role: UserRole.EMPLOYEE },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            subrole: true,
            coins: true,
            createdAt: true
          }
        }
      }
    });

    console.log(`API: Direct company lookup result:`, company ? "Found" : "Not Found");

    // If not found, this might be a User ID with role=COMPANY, so look it up that way
    if (!company) {
      const companyUser = await prisma.user.findFirst({
        where: {
          id,
          role: UserRole.COMPANY
        },
        select: {
          id: true,
          name: true,
          email: true,
          companyId: true,
          coins: true,
          createdAt: true,
          updatedAt: true
        }
      });

      console.log(`API: Company user lookup result:`, companyUser ? `Found with companyId: ${companyUser?.companyId || 'null'}` : "Not Found");

      // If we found a company user, get the actual company data if it has a companyId
      if (companyUser) {
        if (companyUser.companyId) {
          company = await prisma.company.findUnique({
            where: { id: companyUser.companyId },
            include: {
              employees: {
                where: { role: UserRole.EMPLOYEE },
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                  subrole: true,
                  coins: true,
                  createdAt: true
                }
              }
            }
          });
          
          console.log(`API: Related company lookup result:`, company ? "Found" : "Not Found");
        }

        // If we found a company user but no related company record, create a synthetic company object
        if (!company) {
          console.log(`API: Creating synthetic company from user data`);
          
          // Get employees related to this company user
          const employees = await prisma.user.findMany({
            where: { 
              companyId: companyUser.id,
              role: UserRole.EMPLOYEE
            },
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              subrole: true,
              coins: true,
              createdAt: true
            }
          });
          
          console.log(`API: Found ${employees.length} employees for synthetic company`);
          
          return NextResponse.json({
            id: companyUser.id,
            companyId: companyUser.companyId,
            name: companyUser.name,
            email: companyUser.email,
            coins: companyUser.coins || 0,
            createdAt: companyUser.createdAt,
            updatedAt: companyUser.updatedAt,
            employees: employees || [],
            isActive: true, // Default to active
            _synthetic: true
          });
        }
      }
    }

    if (!company) {
      console.log(`API: No company found for ID: ${id}`);
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }

    // Ensure the company object has the expected structure
    const sanitizedCompany = {
      ...company,
      employees: company.employees || [],
      isActive: company.isActive !== undefined ? company.isActive : true,
      coins: company.coins || 0
    };

    console.log(`API: Successfully returning company data for ID: ${id}`);
    return NextResponse.json(sanitizedCompany);
  } catch (error) {
    console.error("Error fetching company:", error);
    return NextResponse.json(
      { error: "Failed to fetch company", details: error instanceof Error ? error.message : String(error) },
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
    const existingCompany = await prisma.company.findUnique({
      where: { id }
    });
    
    if (!existingCompany) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }
    
    // Update company
    const updatedCompany = await prisma.company.update({
      where: { id },
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
    
    // Check if company exists
    const existingCompany = await prisma.company.findUnique({
      where: { id },
      include: {
        employees: true
      }
    });
    
    if (!existingCompany) {
      return NextResponse.json(
        { error: "Company not found" },
        { status: 404 }
      );
    }
    
    // Delete all company users (needed for referential integrity)
    const companyUsers = await prisma.user.findMany({
      where: {
        companyId: id,
        role: UserRole.COMPANY
      }
    });
    
    // Use a transaction to ensure atomicity
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Delete all company employees
      await tx.user.deleteMany({
        where: {
          companyId: id
        }
      });
      
      // Delete the company
      await tx.company.delete({
        where: { id }
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
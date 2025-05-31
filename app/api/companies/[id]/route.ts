import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/lib/enums";
// Supabase types are used instead of Prisma types
import prismaHelper from "@/lib/prisma-helper";

// GET: Fetch a company by ID
export const GET = withAuth(
  async (req: NextRequest, context: { params: Record<string, string> } | undefined) => {
    try {
      if (!context || !context.params) {
        return NextResponse.json(
          { error: "Invalid route parameters" },
          { status: 400 }
        );
      }
      
      const { params } = context;
      const companyId = params.id;
      
      if (!companyId) {
        return NextResponse.json(
          { error: "Company ID is required" },
          { status: 400 }
        );
      }
      
      const { data: company, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', companyId)
        .eq('role', UserRole.COMPANY)
        .single();
      
      if (error) {
        console.error('Error fetching company:', error);
        return NextResponse.json(
          { error: "Company not found" },
          { status: 404 }
        );
      }
      
      // Remove password from response
      const { password, ...companyWithoutPassword } = company;
      
      return NextResponse.json(companyWithoutPassword);
    } catch (error) {
      console.error("Error fetching company:", error);
      return NextResponse.json(
        { error: "Failed to fetch company" },
        { status: 500 }
      );
    }
  },
  [UserRole.ADMIN, UserRole.SUPERADMIN]
);

// PUT: Update a company by ID
export const PUT = withAuth(
  async (req: NextRequest, context: { params: Record<string, string> } | undefined) => {
    try {
      if (!context || !context.params) {
        return NextResponse.json(
          { error: "Invalid route parameters" },
          { status: 400 }
        );
      }
      
      const { params } = context;
      const companyId = params.id;
      
      if (!companyId) {
        return NextResponse.json(
          { error: "Company ID is required" },
          { status: 400 }
        );
      }
      
      const body = await req.json();
      
      // Check if company exists
      const { data: existingCompany, error: checkError } = await supabase
        .from('users')
        .select('*')
        .eq('id', companyId)
        .eq('role', UserRole.COMPANY)
        .single();
      
      if (checkError) {
        console.error('Error fetching company:', checkError);
        return NextResponse.json(
          { error: "Company not found" },
          { status: 404 }
        );
      }
      
      // Update company record
      const { data: updatedCompany, error: updateError } = await supabase
        .from('users')
        .update({
          name: body.name || existingCompany.name,
          email: body.email || existingCompany.email,
          isActive: body.isActive !== undefined ? body.isActive : existingCompany.isActive,
          updatedAt: new Date().toISOString()
        })
        .eq('id', companyId)
        .select('*')
        .single();
      
      if (updateError) {
        console.error('Error updating company:', updateError);
        return NextResponse.json(
          { error: "Failed to update company" },
          { status: 500 }
        );
      }
      
      // Remove password from response
      const { password, ...companyWithoutPassword } = updatedCompany;
      
      return NextResponse.json(companyWithoutPassword);
    } catch (error) {
      console.error("Error updating company:", error);
      return NextResponse.json(
        { error: "Failed to update company" },
        { status: 500 }
      );
    }
  },
  [UserRole.ADMIN, UserRole.SUPERADMIN]
);

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
    const { data: existingCompany, error: companyError } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .eq('role', UserRole.COMPANY)
      .single();
    
    let companyUserId = null;
    let companyId = id;
    
    // If not found directly, check if it's a company user
    if (!existingCompany) {
      console.log(`API DELETE: Company not found directly, checking if it's a company user`);
      
      // Check for a company user with this ID
      const { data: companyUser, error: userError } = await supabase
        .from('users')
        .select('id, companyId')
        .eq('id', id)
        .eq('role', UserRole.COMPANY)
        .single();
      
      // If this is a company user with a companyId, use that ID instead
      if (companyUser) {
        companyUserId = companyUser.id;
        
        if (companyUser.companyId) {
          console.log(`API DELETE: Found company user with companyId: ${companyUser.companyId}`);
          
          companyId = companyUser.companyId;
          const { data: company, error: companyLookupError } = await supabase
            .from('users')
            .select('*')
            .eq('id', companyUser.companyId)
            .eq('role', UserRole.COMPANY)
            .single();
          
          if (!companyLookupError) {
            existingCompany = company;
          }
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
      
      // Delete all related employees
      const { error: deleteEmployeesError } = await supabase
        .from('users')
        .delete()
        .eq('companyId', companyUserId);
      
      if (deleteEmployeesError) {
        console.error('Error deleting employees:', deleteEmployeesError);
        return NextResponse.json(
          { error: "Failed to delete company employees" },
          { status: 500 }
        );
      }
      
      // Delete the company user
      const { error: deleteUserError } = await supabase
        .from('users')
        .delete()
        .eq('id', companyUserId);
      
      if (deleteUserError) {
        console.error('Error deleting company user:', deleteUserError);
        return NextResponse.json(
          { error: "Failed to delete company user" },
          { status: 500 }
        );
      }
      
      return NextResponse.json({
        message: "Company user deleted successfully"
      });
    }
    
    // Delete all company users (needed for referential integrity)
    const { data: companyUsers, error: getUsersError } = await supabase
      .from('users')
      .select('*')
      .eq('companyId', existingCompany!.id)
      .eq('role', UserRole.COMPANY);
    
    if (getUsersError) {
      console.error('Error getting company users:', getUsersError);
    }
    
    // Delete all company employees
    const { error: deleteEmployeesError } = await supabase
      .from('users')
      .delete()
      .eq('companyId', existingCompany!.id);
    
    if (deleteEmployeesError) {
      console.error('Error deleting employees:', deleteEmployeesError);
      return NextResponse.json(
        { error: "Failed to delete company employees" },
        { status: 500 }
      );
    }
    
    // Delete the company user
    const { error: deleteCompanyError } = await supabase
      .from('users')
      .delete()
      .eq('id', existingCompany!.id);
    
    if (deleteCompanyError) {
      console.error('Error deleting company:', deleteCompanyError);
      return NextResponse.json(
        { error: "Failed to delete company" },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      message: "Company deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting company:", error);
    
    // Check if this is a prepared statement error and try to handle it
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json(
      { error: "Failed to delete company", details: errorMessage },
      { status: 500 }
    );
  }
} 
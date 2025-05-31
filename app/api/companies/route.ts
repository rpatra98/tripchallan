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

    const { searchParams } = new URL(req.url);
    
    // Get pagination parameters
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;
    
    // Get search parameters
    const search = searchParams.get("search") || "";
    
    // Get current user's role
    const { data: currentUser, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single();
      
    if (userError) {
      console.error('Error fetching user:', userError);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    let companies = [];
    
    // SUPERADMIN can see all companies
    if (currentUser.role === UserRole.SUPERADMIN) {
      let query = supabase
        .from('users')
        .select('*')
        .eq('role', UserRole.COMPANY);
        
      // Add search filter if provided
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      
      // Add pagination
      const { data, error, count } = await query
        .order('name')
        .range(skip, skip + limit - 1)
        .count();
      
      if (error) {
        console.error('Error fetching companies:', error);
        return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
      }
      
      companies = data || [];
      const totalCount = count || 0;
      
      return NextResponse.json({
        companies: companies.map(company => {
          const { password, ...companyWithoutPassword } = company;
          return companyWithoutPassword;
        }),
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      });
    } 
    // ADMIN can see companies they created
    else if (currentUser.role === UserRole.ADMIN) {
      let query = supabase
        .from('users')
        .select('*')
        .eq('role', UserRole.COMPANY)
        .eq('createdById', currentUser.id);
        
      // Add search filter if provided
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      }
      
      // Add pagination
      const { data, error, count } = await query
        .order('name')
        .range(skip, skip + limit - 1)
        .count();
      
      if (error) {
        console.error('Error fetching admin companies:', error);
        return NextResponse.json({ error: "Failed to fetch companies" }, { status: 500 });
      }
      
      companies = data || [];
      const totalCount = count || 0;
      
      return NextResponse.json({
        companies: companies.map(company => {
          const { password, ...companyWithoutPassword } = company;
          return companyWithoutPassword;
        }),
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      });
    } 
    // COMPANY can only see themselves
    else if (currentUser.role === UserRole.COMPANY) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      
      if (error) {
        console.error('Error fetching company:', error);
        return NextResponse.json({ error: "Failed to fetch company" }, { status: 500 });
      }
      
      const { password, ...companyWithoutPassword } = data;
      
      return NextResponse.json({
        companies: [companyWithoutPassword],
        page: 1,
        limit: 1,
        totalCount: 1,
        totalPages: 1
      });
    } 
    // Other roles can't see companies
    else {
      return NextResponse.json({
        companies: [],
        page,
        limit,
        totalCount: 0,
        totalPages: 0
      });
    }
  } catch (error) {
    console.error("Error fetching companies:", error);
    return NextResponse.json(
      { error: "Failed to fetch companies" },
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
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { UserRole, ActivityAction } from "@/prisma/enums";
import { addActivityLog } from "@/lib/activity-logger";
import supabase from "@/lib/supabase";

interface WhereCondition {
  role?: string;
  companyId?: string;
  createdById?: string;
}

async function handler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const userRole = session.user.role;
    const userId = session.user.id;
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const role = searchParams.get('role') as UserRole | null;
    const search = searchParams.get('search');
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Initialize query to count total records
    let countQuery = supabase.from('users').select('id', { count: 'exact', head: true });
    
    // Initialize query to fetch users
    let query = supabase.from('users').select(`
      *,
      company:companies(id, name, email)
    `);
    
    // Apply filters based on user role
    if (userRole === UserRole.SUPERADMIN) {
      // SuperAdmin can see all users
      if (role) {
        countQuery = countQuery.eq('role', role);
        query = query.eq('role', role);
      }
    } else if (userRole === UserRole.ADMIN) {
      // Admin can only see users from companies they created
      const { data: companiesCreatedByAdmin, error: companyError } = await supabase
        .from('users')
        .select('id, companyId')
        .eq('role', 'COMPANY')
        .eq('createdById', userId);
      
      if (companyError) {
        console.error("Error fetching companies:", companyError);
        return NextResponse.json(
          { error: "Failed to fetch users" },
          { status: 500 }
        );
      }
      
      const companyIds = companiesCreatedByAdmin
        .filter(company => company.companyId)
        .map(company => company.companyId);
        
      const companyUserIds = companiesCreatedByAdmin.map(company => company.id);
      
      // Combine IDs into a unique set, removing nulls
      const validIds = [...new Set([...companyIds, ...companyUserIds])].filter(Boolean);
      
      if (role === UserRole.COMPANY) {
        // If looking for companies, filter by createdById
        countQuery = countQuery.eq('role', UserRole.COMPANY).eq('createdById', userId);
        query = query.eq('role', UserRole.COMPANY).eq('createdById', userId);
      } else if (role === UserRole.EMPLOYEE) {
        // If looking for employees, filter by companyId
        countQuery = countQuery.eq('role', UserRole.EMPLOYEE).in('companyId', validIds);
        query = query.eq('role', UserRole.EMPLOYEE).in('companyId', validIds);
      } else {
        // If no specific role, use OR filter with multiple conditions
        countQuery = countQuery.or(`role.eq.${UserRole.COMPANY},createdById.eq.${userId},role.eq.${UserRole.EMPLOYEE},companyId.in.(${validIds.join(',')})`);
        query = query.or(`role.eq.${UserRole.COMPANY},createdById.eq.${userId},role.eq.${UserRole.EMPLOYEE},companyId.in.(${validIds.join(',')})`);
      }
    } else if (userRole === UserRole.COMPANY) {
      // Company can only see their employees
      countQuery = countQuery.eq('role', UserRole.EMPLOYEE).eq('companyId', userId);
      query = query.eq('role', UserRole.EMPLOYEE).eq('companyId', userId);
    }
    
    // Add search filter if provided
    if (search) {
      // Using Supabase's ILIKE for case-insensitive search
      countQuery = countQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }
    
    // Get total count for pagination
    const { count, error: countError } = await countQuery;
    
    if (countError) {
      console.error("Error counting users:", countError);
      return NextResponse.json(
        { error: "Failed to fetch users count" },
        { status: 500 }
      );
    }
    
    // Get users with pagination
    const { data: users, error: usersError } = await query
      .order('createdAt', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (usersError) {
      console.error("Error fetching users:", usersError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 }
      );
    }
    
    // Remove sensitive fields
    const usersWithoutPassword = users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    // Log the user list view activity
    await addActivityLog({
      userId: userId,
      action: ActivityAction.VIEW,
      details: {
        resourceType: "USER_LIST",
        filters: {
          search: search || undefined,
          role: role || undefined,
          page,
          limit
        },
        resultCount: users.length,
        totalCount: count
      },
      targetResourceType: "USER_LIST"
    });
    
    return NextResponse.json({
      users: usersWithoutPassword,
      pagination: {
        total: count,
        page,
        limit,
        pages: Math.ceil(count! / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}

// All authenticated users can access users list
// (Role-based filtering is done within the handler)
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY
]); 
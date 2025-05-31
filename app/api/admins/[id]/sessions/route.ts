import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { EmployeeSubrole, UserRole } from "@/lib/enums";

// Only SuperAdmin can access admin details
export const GET = withAuth(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
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
      const { data: adminUser, error: adminError } = await supabase
        .from('users')
        .select('*')
        .eq('id', adminId)
        .single();
      
      if (adminError) {
        console.error('Error fetching admin:', adminError);
        return NextResponse.json({ error: 'Failed to fetch admin' }, { status: 500 });
      }
      
      const isSuperAdmin = adminUser?.role === UserRole.SUPERADMIN;
      console.log(`🔍 Admin is SUPERADMIN: ${isSuperAdmin}`);

      // Get companies created by this admin
      const { data: createdCompanies, error: companiesError } = await supabase
        .from('users')
        .select('*')
        .eq('role', UserRole.COMPANY)
        .eq('createdById', adminId);
      
      if (companiesError) {
        console.error('Error fetching created companies:', companiesError);
        return NextResponse.json({ error: 'Failed to fetch created companies' }, { status: 500 });
      }
      
      // Get operators created by this admin
      const { data: operators, error: operatorsError } = await supabase
        .from('users')
        .select('*')
        .eq('role', UserRole.EMPLOYEE)
        .eq('subrole', EmployeeSubrole.OPERATOR)
        .eq('createdById', adminId);
      
      if (operatorsError) {
        console.error('Error fetching operators:', operatorsError);
        return NextResponse.json({ error: 'Failed to fetch operators' }, { status: 500 });
      }

      // Extract IDs for filtering
      const companyIds = createdCompanies?.map(company => company.id) || [];
      const operatorIds = operators?.map(operator => operator.id) || [];
      
      console.log(`🔍 Found ${companyIds.length} companies created by admin`);
      console.log(`🔍 Found ${operatorIds.length} operators created by admin`);

      let sessionsQuery = supabase.from('sessions').select('*');
      
      // Apply filters if we have companies or operators
      if (companyIds.length > 0) {
        sessionsQuery = sessionsQuery.in('companyId', companyIds);
      } else if (operatorIds.length > 0) {
        sessionsQuery = sessionsQuery.in('createdById', operatorIds);
      } else if (!isSuperAdmin) {
        // If admin has no related entities and is not superadmin, return empty array
        return NextResponse.json([]);
      }
      
      // Add status filter if provided
      if (statusFilter) {
        sessionsQuery = sessionsQuery.eq('status', statusFilter);
      }
      
      // Add pagination
      const { data: sessions, error: sessionsError, count } = await sessionsQuery
        .order('createdAt', { ascending: false })
        .range(skip, skip + limit - 1)
        .count();
      
      if (sessionsError) {
        console.error('Error fetching sessions:', sessionsError);
        return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
      }

      // Log for debugging
      if (sessions && sessions.length > 0) {
        console.log(`🔍 Found ${sessions.length} sessions for admin`);
        console.log(`🔍 First session - ID: ${sessions[0].id}, Company: ${sessions[0].companyId || 'Unknown'}`);
      } else {
        console.log('No sessions found');
      }

      return NextResponse.json({
        sessions: sessions || [],
        totalCount: count || 0,
        page,
        totalPages: Math.ceil((count || 0) / limit),
        hasNextPage: page < Math.ceil((count || 0) / limit),
        hasPrevPage: page > 1
      });
    } catch (error) {
      console.error('Error in admin sessions route:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  }, 
  [UserRole.SUPERADMIN]
);
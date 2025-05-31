import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { UserRole, EmployeeSubrole, SessionStatus } from "@/lib/enums";

// This endpoint is for Guards to access sessions they need to verify
async function handler(req: NextRequest) {
  try {
    console.log("[API DEBUG] Guard verification API called");
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // This endpoint is only for GUARD users
    if (session.user.role !== UserRole.EMPLOYEE || session.user.subrole !== EmployeeSubrole.GUARD) {
      return NextResponse.json(
        { error: "This endpoint is only for GUARD users" },
        { status: 403 }
      );
    }

    // Get the guard's company ID
    const { data: guard, error: guardError } = await supabase
      .from('users')
      .select('companyId, company:companyId(id)')
      .eq('id', session.user.id)
      .single();
    
    if (guardError) {
      console.error('Error fetching guard details:', guardError);
      return NextResponse.json({ error: 'Failed to fetch guard details' }, { status: 500 });
    }

    // Get companyId from either direct property or relation
    const guardCompanyId = guard?.companyId || guard?.company?.id;
    
    if (!guardCompanyId) {
      return NextResponse.json(
        { error: "GUARD user is not associated with a company" },
        { status: 400 }
      );
    }

    console.log("[API DEBUG] Guard company ID:", guardCompanyId);

    // Get pagination parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");
    const skip = (page - 1) * limit;
    
    // Parse filter parameters
    const filterByStatus = url.searchParams.get("filterByStatus") === "true";
    const onlyUnverified = url.searchParams.get("onlyUnverified") === "true";
    
    // Fetch active sessions for the guard's company
    const sessionQuery = supabase
      .from('sessions')
      .select(`
        *,
        seal:id(*),
        createdBy:createdById(id, name, role, subrole),
        company:companyId(id, name)
      `)
      .eq('companyId', guardCompanyId)
      .eq('status', SessionStatus.IN_PROGRESS);
    
    // Add pagination
    const paginatedQuery = sessionQuery
      .range(skip, skip + limit - 1)
      .order('createdAt', { ascending: false });
    
    // Execute query
    const { data: sessions, error: sessionsError } = await paginatedQuery;
    
    if (sessionsError) {
      console.error('Error fetching verification sessions:', sessionsError);
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }
    
    // Get total count for pagination
    const { count: totalCount, error: countError } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('companyId', guardCompanyId)
      .eq('status', SessionStatus.IN_PROGRESS);
    
    if (countError) {
      console.error('Error counting sessions:', countError);
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil((totalCount || 0) / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      sessions: sessions || [],
      pagination: {
        page,
        limit,
        totalCount: totalCount || 0,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    });

  } catch (error) {
    console.error("[API ERROR] Error fetching guard verification sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch guard verification sessions" },
      { status: 500 }
    );
  }
}

// GUARD users can access this endpoint
export const GET = withAuth(handler, [UserRole.EMPLOYEE]); 
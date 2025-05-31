import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { UserRole, EmployeeSubrole, SessionStatus } from "@/lib/enums";

// Direct API route for GUARD users to get sessions that need verification
// This bypasses complex filtering that might cause issues
async function handler(req: NextRequest) {
  try {
    console.log("[API DEBUG] Guard verification API called");
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // This endpoint is only for GUARD users
    if (session.user.role !== UserRole.EMPLOYEE || session.user.subrole !== EmployeeSubrole.GUARD) {
      console.log("[API DEBUG] Non-guard user attempted to access guard-verification endpoint:", {
        role: session.user.role,
        subrole: session.user.subrole
      });
      return NextResponse.json(
        { error: "This endpoint is only for GUARD users" },
        { status: 403 }
      );
    }

    // Get the guard's user details including company
    const guard = await supabase.from('users').findUnique({
      where: { id: session.user.id },
      select: { 
        id: true,
        name: true,
        email: true,
        companyId: true,
        company: {
          select: { id: true, name: true }
        }
      }
    });

    if (!guard) {
      console.log("[API DEBUG] Guard user not found in database");
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Get companyId from either direct property or relation
    const guardCompanyId = guard.companyId || guard.company?.id;
    
    if (!guardCompanyId) {
      console.log("[API DEBUG] Guard user has no company association:", guard);
      return NextResponse.json(
        { error: "GUARD user is not associated with a company" },
        { status: 400 }
      );
    }

    console.log("[API DEBUG] Guard information:", {
      id: guard.id,
      name: guard.name,
      email: guard.email,
      companyId: guardCompanyId
    });

    try {
      // First approach: Try to find sessions with seal = {verified: false}
      const sessions = await supabase.from('sessions').select('*').{
        where: {
          companyId: guardCompanyId,
          status: SessionStatus.IN_PROGRESS,
          seal: {
            verified: false
          }
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              subrole: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
            },
          },
          seal: true,
        },
        orderBy: { createdAt: "desc" }
      });
      
      console.log(`[API DEBUG] Found ${sessions.length} sessions needing verification (approach 1)`);
      
      if (sessions.length > 0) {
        return NextResponse.json({ sessions });
      }
    } catch (error) {
      console.error("[API DEBUG] Error in first approach:", error);
      // Continue to fallback approach
    }

    try {
      // Fallback approach: Get all IN_PROGRESS sessions and filter them manually
      const allInProgressSessions = await supabase.from('sessions').select('*').{
        where: {
          companyId: guardCompanyId,
          status: SessionStatus.IN_PROGRESS,
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              subrole: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
            },
          },
          seal: true,
        },
        orderBy: { createdAt: "desc" }
      });
      
      console.log(`[API DEBUG] Found ${allInProgressSessions.length} IN_PROGRESS sessions (approach 2)`);
      
      // Filter manually for sessions with unverified seals
      const sessionsNeedingVerification = allInProgressSessions.filter(
        (session: any) => session.seal && session.seal.verified === false
      );
      
      console.log(`[API DEBUG] After filtering: ${sessionsNeedingVerification.length} sessions need verification`);
      
      return NextResponse.json({ sessions: sessionsNeedingVerification });
      
    } catch (error) {
      console.error("[API DEBUG] Error in fallback approach:", error);
      throw error; // Re-throw to be caught by the outer catch block
    }

  } catch (error) {
    console.error("[API ERROR] Error fetching guard verification sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch guard verification sessions" },
      { status: 500 }
    );
  }
}

export const GET = withAuth(handler, [UserRole.EMPLOYEE]); 
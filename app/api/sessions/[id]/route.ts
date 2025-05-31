import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { supabase } from "@/lib/supabase";
import { withAuth } from "@/lib/auth";
import { UserRole, EmployeeSubrole, SessionStatus, ActivityAction } from "@/lib/enums";
import { addActivityLog } from "@/lib/activity-logger";
import { GET as getSessionDetails } from "@/app/api/session/[id]/route";

/**
 * API route handler for getting session details
 * This is a wrapper around the actual implementation to provide multiple access points
 */
export const GET = async (
  req: NextRequest,
  context: { params: { id: string } }
) => {
  // Forward the request to the actual implementation
  return getSessionDetails(req, context);
};

// For updating a session
export const PUT = withAuth(
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      // Extract ID from URL
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const sessionId = pathParts[pathParts.indexOf('sessions') + 1];

      // Get user's role, company ID, etc.
      const userId = session.user.id;
      const userRole = session.user.role;
      const userSubrole = session.user.subrole;
      const userDetails = await supabase.from('users').findUnique({
        where: { id: userId },
        select: { companyId: true, subrole: true }
      });

      // Get the session to verify ownership
      const existingSession = await supabase.from('sessions').findUnique({
        where: { id: sessionId },
        include: { company: true }
      });

      if (!existingSession) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      // Authorization checks
      let canModify = false;

      if (userRole === UserRole.SUPERADMIN) {
        canModify = true;
      } else if (userRole === UserRole.ADMIN) {
        // Admin can modify sessions from companies they created
        const company = await supabase.from('users').findUnique({
          where: { id: existingSession.companyId },
          select: { createdById: true }
        });
        canModify = company?.createdById === userId;
      } else if (userRole === UserRole.COMPANY) {
        // Company can modify their own sessions
        canModify = existingSession.companyId === userId;
      } else if (userRole === UserRole.EMPLOYEE && userSubrole === EmployeeSubrole.OPERATOR) {
        if (!userDetails?.companyId) {
          return NextResponse.json(
            { error: "Employee is not associated with a company" },
            { status: 403 }
          );
        }
        
        // OPERATOR can only modify sessions if:
        // 1. They are from the same company
        // 2. They have modify permission
        const sameCompany = existingSession.companyId === userDetails.companyId;
        
        if (!sameCompany) {
          return NextResponse.json(
            { error: "You can only modify sessions from your company" },
            { status: 403 }
          );
        }
        
        // Check if the operator has modify permission
        const permissions = await supabase.from('operatorPermissionss').select('*').eq('userId', userId).single();
        
        if (!permissions?.canModify) {
          return NextResponse.json(
            { error: "You don't have permission to modify sessions. Please contact your administrator." },
            { status: 403 }
          );
        }
        
        canModify = true;
      }

      if (!canModify) {
        return NextResponse.json(
          { error: "You are not authorized to modify this session" },
          { status: 403 }
        );
      }

      // Get the update data from the request
      const updateData = await req.json();

      // Prevent modification of critical fields
      delete updateData.id;
      delete updateData.createdAt;
      delete updateData.createdById;
      delete updateData.companyId;

      // Update the session
      const updatedSession = await supabase.from('sessions').update( updateData,
        include: {
          company: true,
          createdBy: {
            select: { id: true, name: true, email: true }
          }
        }
      });

      // Log the activity
      await addActivityLog({
        userId,
        action: ActivityAction.UPDATE,
        details: {
          entityType: "SESSION",
          sessionId: sessionId,
          updateData
        },
        targetResourceId: sessionId,
        targetResourceType: "session"
      });

      return NextResponse.json(updatedSession);
    } catch (error) {
      console.error("Error updating session:", error);
      return NextResponse.json(
        { error: "Failed to update session" },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY, UserRole.EMPLOYEE]
);

// For deleting a session
export const DELETE = withAuth(
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }

      // Extract ID from URL
      const url = new URL(req.url);
      const pathParts = url.pathname.split('/').filter(Boolean);
      const sessionId = pathParts[pathParts.indexOf('sessions') + 1];

      // Get user's role, company ID, etc.
      const userId = session.user.id;
      const userRole = session.user.role;
      const userSubrole = session.user.subrole;
      const userDetails = await supabase.from('users').findUnique({
        where: { id: userId },
        select: { companyId: true, subrole: true }
      });

      // Get the session to verify ownership
      const existingSession = await supabase.from('sessions').findUnique({
        where: { id: sessionId },
        include: { 
          company: true,
          seal: true
        }
      });

      if (!existingSession) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      // Authorization checks
      let canDelete = false;

      if (userRole === UserRole.SUPERADMIN) {
        canDelete = true;
      } else if (userRole === UserRole.ADMIN) {
        // Admin can delete sessions from companies they created
        const company = await supabase.from('users').findUnique({
          where: { id: existingSession.companyId },
          select: { createdById: true }
        });
        canDelete = company?.createdById === userId;
      } else if (userRole === UserRole.COMPANY) {
        // Company can delete their own sessions
        canDelete = existingSession.companyId === userId;
      } else if (userRole === UserRole.EMPLOYEE && userSubrole === EmployeeSubrole.OPERATOR) {
        if (!userDetails?.companyId) {
          return NextResponse.json(
            { error: "Employee is not associated with a company" },
            { status: 403 }
          );
        }
        
        // OPERATOR can only delete sessions if:
        // 1. They are from the same company
        // 2. They have delete permission
        const sameCompany = existingSession.companyId === userDetails.companyId;
        
        if (!sameCompany) {
          return NextResponse.json(
            { error: "You can only delete sessions from your company" },
            { status: 403 }
          );
        }
        
        // Check if the operator has delete permission
        const permissions = await supabase.from('operatorPermissionss').select('*').eq('userId', userId).single();
        
        if (!permissions?.canDelete) {
          return NextResponse.json(
            { error: "You don't have permission to delete sessions. Please contact your administrator." },
            { status: 403 }
          );
        }
        
        canDelete = true;
      }

      if (!canDelete) {
        return NextResponse.json(
          { error: "You are not authorized to delete this session" },
          { status: 403 }
        );
      }

      // Perform deletion with a simpler approach
      try {
        // Step 1: Delete related comments first since they directly reference the session
        await prisma.comment.deleteMany({ 
          where: { sessionId } 
        });
        console.log(`Deleted comments for session ${sessionId}`);
        
        // Step 2: Delete the seal if it exists (it has a foreign key constraint)
        if (existingSession.seal) {
          await supabase.from('seals').delete().eq('sessionId } 
          });
          console.log(`Deleted seal for session ${sessionId}`);
        }
        
        // Step 3', Delete);
        console.log(`Deleted activity logs for session ${sessionId}`);
        
        // Step 4: Finally delete the session itself
        await supabase.from('sessions').delete().eq('id', sessionId);
        console.log(`Deleted session ${sessionId}`);

        // Log the activity for the deletion
        await addActivityLog({
          userId,
          action: ActivityAction.DELETE,
          details: {
            entityType: "SESSION",
            sessionId,
            sessionData: {
              id: existingSession.id,
              source: existingSession.source,
              destination: existingSession.destination,
              status: existingSession.status
            }
          },
          targetResourceType: "session_deleted"
        });
        console.log(`Added deletion activity log for session ${sessionId}`);

        return NextResponse.json({ success: true, message: "Session deleted successfully" });
      } catch (error) {
        console.error("Error deleting session:", error);
        
        // Add more specific error information for debugging
        let errorMessage = "Failed to delete session";
        if (error instanceof Error) {
          errorMessage += `: ${error.message}`;
          console.error("Error stack:", error.stack);
        }
        
        return NextResponse.json(
          { error: errorMessage },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error("Error in authentication/authorization:", error);
      
      let errorMessage = "Failed to authenticate or authorize deletion";
      if (error instanceof Error) {
        errorMessage += `: ${error.message}`;
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY, UserRole.EMPLOYEE]
); 
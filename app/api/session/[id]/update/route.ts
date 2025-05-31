import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { supabase } from "@/lib/supabase";
import { addActivityLog } from "@/lib/activity-logger";
import { UserRole, EmployeeSubrole, ActivityAction } from "@/lib/enums";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Unauthorized access" },
        { status: 401 }
      );
    }
    
    // Parse request body
    const data = await request.json();
    
    // Get session ID from params
    const sessionId = params.id;
    
    // Check if session exists
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

    // Check permission based on user role
    const userId = session.user.id;
    const userRole = session.user.role;
    const userSubrole = session.user.subrole;
    
    // Only operators with edit permission can edit sessions
    if (userRole === UserRole.EMPLOYEE && userSubrole === EmployeeSubrole.OPERATOR) {
      // Check if operator has permission to edit sessions
      const employee = await supabase.from('users').findUnique({
        where: { id: userId },
        include: {
          operatorPermissions: true,
        },
      });
      
      if (!employee?.operatorPermissions?.canModify) {
        return NextResponse.json(
          { error: "You don't have permission to edit sessions" },
          { status: 403 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "You don't have permission to edit sessions" },
        { status: 403 }
      );
    }
    
    // Process image updates if any
    const imageUpdates = data.images || {};
    
    // Update seal information if provided and not already verified
    let sealUpdates: any = undefined;
    if (data.seal && data.seal.barcode) {
      // Check if the session already has a seal
      if (existingSession.seal) {
        // Only allow updating if the seal is not verified
        if (!existingSession.seal.verified) {
          sealUpdates = {
            seal: {
              update: {
                barcode: data.seal.barcode
              }
            }
          };
        }
      } else {
        // Create new seal
        sealUpdates = {
          seal: {
            create: {
              barcode: data.seal.barcode,
              verified: false
            }
          }
        };
      }
    }
    
    // Update the session
    const { data: updatedSession, error: updateError } = await supabase
      .from('sessions')
      .update({
        ...data,
        // Record update timestamp
        updatedAt: new Date(),
      })
      .eq('id', sessionId)
      .select(`
        *,
        company:companyId(*),
        seal:id(*)
      `)
      .single();
    
    if (updateError) {
      console.error('Error updating session:', updateError);
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }
    
    // Log activity
    await addActivityLog({
      action: ActivityAction.UPDATE,
      userId: userId,
      targetResourceId: sessionId,
      targetResourceType: "SESSION",
      details: {
        sessionId: sessionId,
        updates: {
          source: data.source,
          destination: data.destination,
          ...(data.tripDetails && { tripDetails: data.tripDetails }),
          ...(data.images && { images: data.images }),
          ...(data.seal && { seal: data.seal })
        },
      },
    });
    
    return NextResponse.json(updatedSession);
  } catch (error: any) {
    console.error("Error updating session:", error);
    
    return NextResponse.json(
      { error: `Failed to update session: ${error.message}` },
      { status: 500 }
    );
  }
} 
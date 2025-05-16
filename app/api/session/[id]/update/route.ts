import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { addActivityLog } from "@/lib/activity-logger";
import { UserRole, EmployeeSubrole, ActivityAction } from "@/prisma/enums";

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
    const existingSession = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        company: true,
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
    
    // Only operators with edit permission or admins/superadmins can edit sessions
    if (userRole === UserRole.EMPLOYEE && userSubrole === EmployeeSubrole.OPERATOR) {
      // Check if operator has permission to edit sessions
      const employee = await prisma.user.findUnique({
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
    } else if (userRole !== UserRole.ADMIN && userRole !== UserRole.SUPERADMIN) {
      return NextResponse.json(
        { error: "You don't have permission to edit sessions" },
        { status: 403 }
      );
    }
    
    // Update session with new data
    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        source: data.source,
        destination: data.destination,
        // Only update tripDetails if provided
        ...(data.tripDetails && {
          tripDetails: {
            update: {
              data: {
                ...data.tripDetails,
              },
            },
          },
        }),
        // Record update timestamp
        updatedAt: new Date(),
      },
      include: {
        company: true,
      },
    });
    
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
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { supabase } from "@/lib/supabase";
import { ActivityAction, EmployeeSubrole, SealStatus, UserRole } from "@/lib/enums";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; sealId: string } }
) {
  try {
    console.log("[API DEBUG] Updating seal status:", params);
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await supabase.from('users').findUnique({
      where: { email: session.user.email },
      select: { id: true, name: true, email: true, role: true, subrole: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only guards can update seal status
    if (user.role !== UserRole.EMPLOYEE || user.subrole !== EmployeeSubrole.GUARD) {
      return NextResponse.json(
        { error: "Only guards can update seal status" },
        { status: 403 }
      );
    }

    const { status, comment, evidence } = await req.json();
    
    // Validate status is a valid SealStatus
    if (!Object.values(SealStatus).includes(status)) {
      return NextResponse.json(
        { error: "Invalid status", validStatuses: Object.values(SealStatus) },
        { status: 400 }
      );
    }

    // Get the current seal
    const existingSeal = await supabase.from('seals').findUnique({
      where: { id: params.sealId },
      include: { session: true }
    });

    if (!existingSeal) {
      return NextResponse.json({ error: "Seal not found" }, { status: 404 });
    }

    // Check if session ID matches
    if (existingSeal.sessionId !== params.id) {
      return NextResponse.json(
        { error: "Seal does not belong to this session" },
        { status: 400 }
      );
    }

    // Check if the current status can be changed to the requested status
    if (existingSeal.status) {
      // Only VERIFIED status can be changed to BROKEN or TAMPERED
      if (existingSeal.status !== SealStatus.VERIFIED && 
          (status === SealStatus.BROKEN || status === SealStatus.TAMPERED)) {
        return NextResponse.json(
          { error: `Cannot change status from ${existingSeal.status} to ${status}` },
          { status: 400 }
        );
      }

      // MISSING, BROKEN, and TAMPERED statuses cannot be changed
      if ((existingSeal.status === SealStatus.MISSING || 
           existingSeal.status === SealStatus.BROKEN ||
           existingSeal.status === SealStatus.TAMPERED) && 
           status !== existingSeal.status) {
        return NextResponse.json(
          { error: `Cannot change status from ${existingSeal.status} to ${status}` },
          { status: 400 }
        );
      }
    }

    // Validate evidence requirements
    if ((status === SealStatus.BROKEN || status === SealStatus.TAMPERED) && !evidence) {
      return NextResponse.json(
        { error: `Evidence is required for ${status} status` },
        { status: 400 }
      );
    }

    // Update the seal status
    const { data: updatedSeal, error: updateError } = await supabase
      .from('seals')
      .update({
        status,
        statusComment: comment || null,
        statusUpdatedAt: status !== existingSeal.status
          ? new Date()
          : existingSeal.scannedAt
      })
      .eq('id', params.sealId)
      .select(`
        *,
        session:sessionId(*),
        verifiedBy:verifiedById(*)
      `)
      .single();
    
    if (updateError) {
      console.error('Error updating seal status:', updateError);
      return NextResponse.json({ error: 'Failed to update seal status' }, { status: 500 });
    }

    // Create activity log
    const { error: logError } = await supabase
      .from('activityLogs')
      .insert({
        userId: user.id,
        action: "UPDATE",
        targetResourceId: params.sealId,
        targetResourceType: 'seal',
        details: {
          sealStatus: {
            previous: existingSeal.status,
            current: status,
            comment: comment || null,
            evidence: evidence || null,
            updatedAt: new Date().toISOString(),
            updatedBy: {
              id: user.id,
              name: user.name,
              role: user.role,
              subrole: user.subrole
            }
          }
        }
      });
    
    if (logError) {
      console.error('Error creating activity log:', logError);
      // Continue without logging
    }

    return NextResponse.json({ 
      success: true, 
      seal: updatedSeal 
    });
  } catch (error) {
    console.error("[API ERROR] Error updating seal status:", error);
    return NextResponse.json(
      { error: "Failed to update seal status", details: String(error) },
      { status: 500 }
    );
  }
} 
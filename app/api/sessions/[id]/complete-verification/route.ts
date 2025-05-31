import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { supabase } from "@/lib/supabase";
import { ActivityAction, EmployeeSubrole, SealStatus, SessionStatus, UserRole } from "@/lib/enums";
import { sendVerificationEmail } from "@/lib/email";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log("[API DEBUG] Completing session verification:", params.id);
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

    // Only guards can complete verification
    if (user.role !== UserRole.EMPLOYEE || user.subrole !== EmployeeSubrole.GUARD) {
      return NextResponse.json(
        { error: "Only guards can complete verification" },
        { status: 403 }
      );
    }

    // Get the session
    const sessionData = await supabase.from('sessions').findUnique({
      where: { id: params.id },
      include: {
        seal: true,
        company: true,
        createdBy: true
      }
    });

    if (!sessionData) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get the seal tags for this session (from activity logs)
    const { data: activityLogs, error: logsError } = await supabase
      .from('activityLogs')
      .select(`
        *,
        user:userId(
          id, name, role, subrole
        )
      `)
      .eq('targetResourceId', params.id)
      .eq('targetResourceType', 'session')
      .order('createdAt', { ascending: false });
    
    if (logsError) {
      console.error('Error fetching activity logs:', logsError);
      return NextResponse.json({ error: 'Failed to fetch activity logs' }, { status: 500 });
    }

    // Get seal tag IDs from activity logs
    let sealTagIds: string[] = [];
    for (const log of activityLogs || []) {
      const details = log.details as any;
      
      if (details?.sealTagIds) {
        try {
          const ids = typeof details.sealTagIds === 'string' 
            ? JSON.parse(details.sealTagIds)
            : details.sealTagIds;
          
          sealTagIds = [...sealTagIds, ...ids];
        } catch (e) {
          console.log("[API DEBUG] Error parsing sealTagIds:", e);
        }
      } else if (details?.tripDetails?.sealTagIds) {
        sealTagIds = [...sealTagIds, ...details.tripDetails.sealTagIds];
      } else if (details?.imageBase64Data?.sealTagImages) {
        sealTagIds = [...sealTagIds, ...Object.keys(details.imageBase64Data.sealTagImages)];
      }
    }
    
    // Remove duplicates
    sealTagIds = [...new Set(sealTagIds)];
    
    console.log(`[API DEBUG] Found ${sealTagIds.length} unique seal tags for session ${params.id}`);

    // Examine the request for verification data
    const { verificationData, unscannedSealTagIds } = await req.json();
    
    // Create verification summary in activity log
    const activityLogData = {
      action: ActivityAction.UPDATE,
      userId: user.id,
      targetResourceId: params.id,
      targetResourceType: 'session',
      details: {
        verification: {
          completedBy: {
            id: user.id,
            name: user.name,
            role: user.role,
            subrole: user.subrole
          },
          completedAt: new Date().toISOString(),
          sealTags: {
            total: sealTagIds.length,
            verified: sealTagIds.length - unscannedSealTagIds.length,
            missing: unscannedSealTagIds.length,
            broken: 0, // Will be incremented later
            tampered: 0 // Will be incremented later
          },
          verificationData
        }
      }
    };

    // Run everything in a sequence of operations
    try {
      // 1. Update all unscanned seal tag IDs to MISSING status
      for (const sealTagId of unscannedSealTagIds) {
        // Check if we have a system seal for this tag
        const { data: existingSeal, error: sealError } = await supabase
          .from('seals')
          .select('*')
          .eq('barcode', sealTagId)
          .eq('sessionId', params.id)
          .single();
        
        if (sealError && !sealError.message?.includes('No rows found')) {
          console.error('Error checking existing seal:', sealError);
          // Continue with other seals
        }

        if (existingSeal) {
          // Update the existing seal
          const { error: updateError } = await supabase
            .from('seals')
            .update({
              status: SealStatus.MISSING,
              statusComment: "Seal not found during verification",
              statusUpdatedAt: new Date()
            })
            .eq('id', existingSeal.id);
          
          if (updateError) {
            console.error('Error updating seal:', updateError);
            // Continue with other seals
          }
        } else {
          // Create a new seal for this tag
          const { error: insertError } = await supabase
            .from('seals')
            .insert({
              barcode: sealTagId,
              status: SealStatus.MISSING,
              statusComment: "Seal not found during verification",
              statusUpdatedAt: new Date(),
              sessionId: params.id
            });
          
          if (insertError) {
            console.error('Error creating seal:', insertError);
            // Continue with other seals
          }
        }

        // Increment the missing count in the activity log
        activityLogData.details.verification.sealTags.missing++;
      }

      // 2. Check for BROKEN or TAMPERED seals and update counts
      const { count: brokenSeals, error: brokenError } = await supabase
        .from('seals')
        .select('*', { count: 'exact', head: true })
        .eq('sessionId', params.id)
        .eq('status', SealStatus.BROKEN);
      
      if (brokenError) {
        console.error('Error counting broken seals:', brokenError);
      }
      
      const { count: tamperedSeals, error: tamperedError } = await supabase
        .from('seals')
        .select('*', { count: 'exact', head: true })
        .eq('sessionId', params.id)
        .eq('status', SealStatus.TAMPERED);
      
      if (tamperedError) {
        console.error('Error counting tampered seals:', tamperedError);
      }
      
      activityLogData.details.verification.sealTags.broken = brokenSeals || 0;
      activityLogData.details.verification.sealTags.tampered = tamperedSeals || 0;

      // 3. Create the activity log
      const { data: activityLog, error: logError } = await supabase
        .from('activityLogs')
        .insert(activityLogData)
        .select()
        .single();
      
      if (logError) {
        console.error('Error creating activity log:', logError);
        return NextResponse.json({ error: 'Failed to create activity log' }, { status: 500 });
      }

      // 4. Update the session status to COMPLETED
      const { data: updatedSession, error: sessionError } = await supabase
        .from('sessions')
        .update({
          status: SessionStatus.COMPLETED
        })
        .eq('id', params.id)
        .select(`
          *,
          seal:id(*),
          company:companyId(*),
          createdBy:createdById(*)
        `)
        .single();
      
      if (sessionError) {
        console.error('Error updating session:', sessionError);
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
      }

      // Send email notification if the session's company has an email
      let emailSent = false;
      let emailError: any = null;
      const companyEmail = updatedSession?.company?.email;
      
      if (companyEmail) {
        try {
          console.log(`[API] Sending verification email to company: ${companyEmail}`);
          
          // Get the seal details to include in email
          const firstSeal = updatedSession.seal || null;
          
          const emailResult = await sendVerificationEmail({
            sessionId: params.id,
            sessionDetails: updatedSession,
            companyEmail,
            guardName: user.name || 'Guard',
            verificationDetails: activityLog.details.verification,
            sealDetails: firstSeal,
            timestamp: activityLog.details.verification.completedAt
          });
          
          emailSent = emailResult.success;
          
          if (emailResult.success) {
            console.log(`[API] Verification email sent to company email: ${companyEmail}`);
          } else {
            console.error("[API] Email sending returned error:", emailResult.error);
            emailError = emailResult.error;
          }
        } catch (e) {
          console.error("[API] Failed to send verification email:", e);
          emailError = e;
        }
      } else {
        console.log("[API] No company email found, skipping verification email");
      }

      return NextResponse.json({
        success: true,
        session: updatedSession,
        verificationSummary: activityLog.details.verification,
        emailSent,
        emailError: emailError ? String(emailError) : null
      });
    } catch (error) {
      console.error("[API ERROR] Error completing verification:", error);
      return NextResponse.json(
        { error: "Failed to complete verification", details: String(error) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[API ERROR] Error completing verification:", error);
    return NextResponse.json(
      { error: "Failed to complete verification", details: String(error) },
      { status: 500 }
    );
  }
} 
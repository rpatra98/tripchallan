import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { ActivityAction, EmployeeSubrole, SealStatus, SessionStatus, UserRole } from "@/prisma/enums";
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

    const user = await prisma.user.findUnique({
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
    const sessionData = await prisma.session.findUnique({
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
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        targetResourceId: params.id,
        targetResourceType: 'session',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true,
            subrole: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get seal tag IDs from activity logs
    let sealTagIds: string[] = [];
    for (const log of activityLogs) {
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

    // Run everything in a transaction
    const results = await prisma.$transaction(async (tx: any) => {
      // 1. Update all unscanned seal tag IDs to MISSING status
      for (const sealTagId of unscannedSealTagIds) {
        // Check if we have a system seal for this tag
        const existingSeal = await tx.seal.findFirst({
          where: {
            barcode: sealTagId,
            session: { id: params.id }
          }
        });

        if (existingSeal) {
          // Update the existing seal
          await tx.seal.update({
            where: { id: existingSeal.id },
            data: {
              status: SealStatus.MISSING,
              statusComment: "Seal not found during verification",
              statusUpdatedAt: new Date()
            }
          });
        } else {
          // Create a new seal for this tag
          await tx.seal.create({
            data: {
              barcode: sealTagId,
              status: SealStatus.MISSING,
              statusComment: "Seal not found during verification",
              statusUpdatedAt: new Date(),
              session: { connect: { id: params.id } }
            }
          });
        }

        // Increment the missing count in the activity log
        activityLogData.details.verification.sealTags.missing++;
      }

      // 2. Check for BROKEN or TAMPERED seals and update counts
      const brokenSeals = await tx.seal.count({
        where: {
          sessionId: params.id,
          status: SealStatus.BROKEN
        }
      });
      
      const tamperedSeals = await tx.seal.count({
        where: {
          sessionId: params.id,
          status: SealStatus.TAMPERED
        }
      });
      
      activityLogData.details.verification.sealTags.broken = brokenSeals;
      activityLogData.details.verification.sealTags.tampered = tamperedSeals;

      // 3. Create the activity log
      const activityLog = await tx.activityLog.create({
        data: activityLogData
      });

      // 4. Update the session status to COMPLETED
      const updatedSession = await tx.session.update({
        where: { id: params.id },
        data: {
          status: SessionStatus.COMPLETED
        },
        include: {
          seal: true,
          company: true,
          createdBy: true
        }
      });

      return { session: updatedSession, activityLog };
    });

    // Send email notification if the session's company has an email
    let emailSent = false;
    let emailError: any = null;
    const companyEmail = results.session?.company?.email;
    
    if (companyEmail) {
      try {
        console.log(`[API] Sending verification email to company: ${companyEmail}`);
        
        // Get the seal details to include in email
        const firstSeal = results.session.seal || null;
        
        const emailResult = await sendVerificationEmail({
          sessionId: params.id,
          sessionDetails: results.session,
          companyEmail,
          guardName: user.name || 'Guard',
          verificationDetails: results.activityLog.details.verification,
          sealDetails: firstSeal,
          timestamp: results.activityLog.details.verification.completedAt
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
      session: results.session,
      verificationSummary: results.activityLog.details.verification,
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
} 
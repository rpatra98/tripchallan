import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { supabase } from "@/lib/supabase";
import { EmployeeSubrole, UserRole } from "@/lib/enums";
import { sendVerificationEmail } from "@/lib/email";
// Supabase types are used instead of Prisma types

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const sessionId = url.searchParams.get("sessionId");

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    const { data: seal, error } = await supabase
      .from('seals')
      .select(`
        *,
        session:sessionId(*),
        verifiedBy:verifiedById(id, name, email)
      `)
      .eq('sessionId', sessionId)
      .single();

    if (error && !error.message?.includes('No rows found')) {
      console.error('Error fetching seal:', error);
      return NextResponse.json({ error: 'Failed to fetch seal' }, { status: 500 });
    }

    return NextResponse.json(seal || null);
  } catch (error) {
    console.error("Error fetching seal:", error);
    return NextResponse.json(
      { error: "Failed to fetch seal" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only guards can verify seals
    if (user.role !== UserRole.EMPLOYEE || user.subrole !== EmployeeSubrole.GUARD) {
      return NextResponse.json(
        { error: "Only guards can verify seals" },
        { status: 403 }
      );
    }

    const { sessionId, verificationData } = await req.json();

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Check if the session exists
    const { data: existingSession, error: sessionError } = await supabase
      .from('sessions')
      .select(`
        *,
        company:companyId(*),
        createdBy:createdById(*)
      `)
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      console.error('Error fetching session:', sessionError);
      return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
    }

    if (!existingSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Check if the session already has a seal
    const { data: existingSeal, error: sealError } = await supabase
      .from('seals')
      .select('*')
      .eq('sessionId', sessionId)
      .single();

    if (sealError && !sealError.message?.includes('No rows found')) {
      console.error('Error checking existing seal:', sealError);
      return NextResponse.json({ error: 'Failed to check existing seal' }, { status: 500 });
    }

    if (existingSeal) {
      return NextResponse.json(
        { error: "Session already has a seal" },
        { status: 400 }
      );
    }

    // Create the seal
    const sealData: any = {
      sessionId,
      barcode: `GENERATED-${Date.now()}`,
    };
    
    // If this is a verification request from a guard
    if (verificationData && user.role === UserRole.EMPLOYEE && user.subrole === EmployeeSubrole.GUARD) {
      // Set the seal as verified immediately
      sealData.verified = true;
      sealData.verifiedById = user.id;
      sealData.scannedAt = new Date();
      
      // Create the seal with verification
      const { data: seal, error: insertError } = await supabase
        .from('seals')
        .insert(sealData)
        .select('*, verifiedBy:verifiedById(*)');
        
      if (insertError) {
        console.error('Error creating seal:', insertError);
        return NextResponse.json({ error: 'Failed to create seal' }, { status: 500 });
      }
        
      // Update session status to COMPLETED
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ status: "COMPLETED" })
        .eq('id', sessionId);
        
      if (updateError) {
        console.error('Error updating session:', updateError);
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
      }
        
      // Store verification data in activity log
      const { error: logError } = await supabase
        .from('activityLogs')
        .insert({
          userId: user.id,
          action: "UPDATE",
          targetResourceId: sessionId,
          targetResourceType: "session",
          details: {
            verification: {
              timestamp: new Date().toISOString(),
              sealId: seal ? seal.id : null,
              fieldVerifications: verificationData.fieldVerifications,
              imageVerifications: verificationData.imageVerifications,
              allMatch: verificationData.allMatch
            }
          }
        });
        
      if (logError) {
        console.error('Error creating activity log:', logError);
        // Continue even if log creation fails
      }
      
      // Get company email to send notification
      let companyEmail = existingSession.company?.email;
      
      // Get company data
      if (!companyEmail && existingSession.company?.id) {
        const { data: company, error: companyError } = await supabase
          .from('companys')
          .select('email')
          .eq('id', existingSession.company.id)
          .single();
        
        if (companyError) {
          console.error('Error fetching company:', companyError);
          // Continue without email
        } else {
          companyEmail = company?.email;
        }
      }
      
      // Send email notification if company email is available
      if (companyEmail) {
        try {
          await sendVerificationEmail({
            sessionId,
            sessionDetails: existingSession,
            companyEmail,
            guardName: user.name || 'Guard',
            verificationDetails: verificationData,
            sealDetails: seal,
            timestamp: new Date().toISOString(),
          });
          
          console.log(`[API] Verification email sent to ${companyEmail}`);
        } catch (emailError) {
          console.error("[API] Failed to send verification email:", emailError);
          // Continue execution even if email fails
        }
      } else {
        console.log("[API] No company email found, skipping verification email");
      }
      
      return NextResponse.json({
        ...seal,
        verificationDetails: {
          allMatch: verificationData.allMatch,
          fieldVerifications: verificationData.fieldVerifications
        }
      });
    } else {
      // Create a regular seal
      const { data: seal, error: insertError } = await supabase
        .from('seals')
        .insert(sealData)
        .select();

      if (insertError) {
        console.error('Error creating seal:', insertError);
        return NextResponse.json({ error: 'Failed to create seal' }, { status: 500 });
      }

      // Update session status to IN_PROGRESS
      const { error: updateError } = await supabase
        .from('sessions')
        .update({ status: "IN_PROGRESS" })
        .eq('id', sessionId);

      if (updateError) {
        console.error('Error updating session:', updateError);
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
      }

      return NextResponse.json(seal);
    }
  } catch (error) {
    console.error("Error creating seal:", error);
    return NextResponse.json(
      { error: "Failed to create seal" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', session.user.email)
      .single();

    if (userError) {
      console.error('Error fetching user:', userError);
      return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
    }

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Only guards can verify seals
    if (user.role !== UserRole.EMPLOYEE || user.subrole !== EmployeeSubrole.GUARD) {
      return NextResponse.json(
        { error: "Only guards can verify seals" },
        { status: 403 }
      );
    }

    const { sealId, verificationData } = await req.json();

    if (!sealId) {
      return NextResponse.json(
        { error: "Seal ID is required" },
        { status: 400 }
      );
    }

    // Validate verification data is present
    if (!verificationData) {
      console.error("Missing verification data in request:", { sealId });
      return NextResponse.json(
        { error: "Verification data is required" },
        { status: 400 }
      );
    }

    // Check if the seal exists
    const { data: existingSeal, error: sealError } = await supabase
      .from('seals')
      .select(`
        *,
        session:sessionId(
          *,
          company:companyId(*),
          createdBy:createdById(*)
        )
      `)
      .eq('id', sealId)
      .single();

    if (sealError) {
      console.error('Error fetching seal:', sealError);
      return NextResponse.json({ error: 'Failed to fetch seal' }, { status: 500 });
    }

    if (!existingSeal) {
      return NextResponse.json(
        { error: "Seal not found" },
        { status: 404 }
      );
    }

    // Check if the seal is already verified
    if (existingSeal.verified) {
      return NextResponse.json(
        { error: "Seal is already verified" },
        { status: 400 }
      );
    }

    try {
      // Update the seal as verified
      const { data: updatedSeal, error: updateSealError } = await supabase
        .from('seals')
        .update({
          verified: true,
          verifiedById: user.id,
          scannedAt: new Date()
        })
        .eq('id', sealId)
        .select(`
          *,
          verifiedBy:verifiedById(*),
          session:sessionId(
            *,
            company:companyId(*),
            createdBy:createdById(*)
          )
        `)
        .single();
      
      if (updateSealError) {
        console.error('Error updating seal:', updateSealError);
        return NextResponse.json({ error: 'Failed to update seal' }, { status: 500 });
      }

      // Update session status to COMPLETED
      const { error: updateSessionError } = await supabase
        .from('sessions')
        .update({ status: "COMPLETED" })
        .eq('id', updatedSeal.sessionId);
      
      if (updateSessionError) {
        console.error('Error updating session:', updateSessionError);
        return NextResponse.json({ error: 'Failed to update session status' }, { status: 500 });
      }

      // Store verification data in activity log
      const { error: logError } = await supabase
        .from('activityLogs')
        .insert({
          userId: user.id,
          action: "UPDATE",
          targetResourceId: updatedSeal.sessionId,
          targetResourceType: "session",
          details: {
            verification: {
              timestamp: new Date().toISOString(),
              sealId: sealId,
              fieldVerifications: verificationData.fieldVerifications,
              imageVerifications: verificationData.imageVerifications,
              allMatch: verificationData.allMatch
            }
          }
        });
      
      if (logError) {
        console.error('Error creating activity log:', logError);
        // Continue even if log creation fails
      }

      // Get company email to send notification
      let companyEmail = updatedSeal.session?.company?.email;
      
      // Get company data
      if (!companyEmail && updatedSeal.session?.company?.id) {
        const { data: company, error: companyError } = await supabase
          .from('companys')
          .select('email')
          .eq('id', updatedSeal.session.company.id)
          .single();
        
        if (companyError) {
          console.error('Error fetching company:', companyError);
          // Continue without email
        } else {
          companyEmail = company?.email;
        }
      }
      
      // Send email notification if company email is available
      let emailSent = false;
      let emailError: any = null;
      
      if (companyEmail) {
        try {
          const emailResult = await sendVerificationEmail({
            sessionId: updatedSeal.sessionId,
            sessionDetails: updatedSeal.session,
            companyEmail,
            guardName: user.name || 'Guard',
            verificationDetails: verificationData,
            sealDetails: updatedSeal,
            timestamp: new Date().toISOString(),
          });
          
          emailSent = emailResult.success;
          
          if (emailResult.success) {
            console.log(`[API] Verification email sent to ${companyEmail}`);
          } else {
            console.error("[API] Email sending returned error:", emailResult.error);
            emailError = emailResult.error;
          }
        } catch (e) {
          console.error("[API] Failed to send verification email:", e);
          emailError = e;
          // Continue execution even if email fails
        }
      } else {
        console.log("[API] No company email found, skipping verification email");
      }

    return NextResponse.json({
        ...updatedSeal,
      verificationDetails: {
        allMatch: verificationData.allMatch,
        fieldVerifications: verificationData.fieldVerifications
        },
        emailSent,
        emailError: emailError ? String(emailError) : null
      });
    } catch (error) {
      console.error("Error verifying seal:", error);
      return NextResponse.json(
        { error: "Failed to verify seal" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error verifying seal:", error);
    return NextResponse.json(
      { error: "Failed to verify seal" },
      { status: 500 }
    );
  }
} 
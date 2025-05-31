import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { EmployeeSubrole, SessionStatus, UserRole } from "@/lib/enums";

async function handler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await req.json();
    const { barcode } = body;

    // Validation
    if (!barcode) {
      return NextResponse.json(
        { error: "Barcode is required" },
        { status: 400 }
      );
    }

    // Only guards can verify seals
    if (session?.user.subrole !== EmployeeSubrole.GUARD) {
      return NextResponse.json(
        { error: "Only guards can verify seals" },
        { status: 403 }
      );
    }

    // Find the seal by barcode
    const seal = await supabase.from('seals').findFirst({
      where: { barcode },
      include: { session: true }
    });

    if (!seal) {
      return NextResponse.json(
        { error: "Seal not found" },
        { status: 404 }
      );
    }

    if (seal.verified) {
      return NextResponse.json(
        { error: "Seal has already been verified" },
        { status: 400 }
      );
    }

    // Update the seal status
    const { data: updatedSeal, error: sealError } = await supabase
      .from('seals')
      .update({
        verified: true,
        verifiedById: session.user.id,
        scannedAt: new Date()
      })
      .eq('id', seal.id)
      .select();

    if (sealError) {
      console.error('Error updating seal:', sealError);
      return NextResponse.json({ error: 'Failed to update seal' }, { status: 500 });
    }

    // Update the session status to COMPLETED
    const { data: updatedSession, error: sessionError } = await supabase
      .from('sessions')
      .update({ status: SessionStatus.COMPLETED })
      .eq('id', seal.sessionId)
      .select();

    if (sessionError) {
      console.error('Error updating session:', sessionError);
      return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
    }

    return NextResponse.json(
      { 
        message: "Seal verified successfully", 
        seal: updatedSeal,
        session: updatedSession
      }, 
      { status: 200 }
    );
  } catch (error) {
    console.error("Error verifying seal:", error);
    return NextResponse.json(
      { error: "Failed to verify seal" },
      { status: 500 }
    );
  }
}

// Only employees with GUARD subrole can verify seals
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      const userId = session?.user.id;
      const userRole = session?.user.role;
      const userSubrole = session?.user.subrole;
      const body = await req.json();
      const { barcode } = body;

      // Validation
      if (!barcode) {
        return NextResponse.json(
          { error: "Barcode is required" },
          { status: 400 }
        );
      }

      // Only guards can verify seals
      if (userSubrole !== EmployeeSubrole.GUARD) {
        return NextResponse.json(
          { error: "Only guards can verify seals" },
          { status: 403 }
        );
      }

      // Find the seal by barcode
      const seal = await supabase.from('seals').findFirst({
        where: { barcode },
        include: { session: true }
      });

      if (!seal) {
        return NextResponse.json(
          { error: "Seal not found" },
          { status: 404 }
        );
      }

      if (seal.verified) {
        return NextResponse.json(
          { error: "Seal has already been verified" },
          { status: 400 }
        );
      }

      // Update the seal status
      const { data: updatedSeal, error: sealError } = await supabase
        .from('seals')
        .update({
          verified: true,
          verifiedById: userId,
          scannedAt: new Date()
        })
        .eq('id', seal.id)
        .select();

      if (sealError) {
        console.error('Error updating seal:', sealError);
        return NextResponse.json({ error: 'Failed to update seal' }, { status: 500 });
      }

      // Update the session status to COMPLETED
      const { data: updatedSession, error: sessionError } = await supabase
        .from('sessions')
        .update({ status: SessionStatus.COMPLETED })
        .eq('id', seal.sessionId)
        .select();

      if (sessionError) {
        console.error('Error updating session:', sessionError);
        return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
      }

      return NextResponse.json(
        { 
          message: "Seal verified successfully", 
          seal: updatedSeal,
          session: updatedSession
        }, 
        { status: 200 }
      );
    } catch (error) {
      console.error("Error verifying seal:", error);
      return NextResponse.json(
        { error: "Failed to verify seal" },
        { status: 500 }
      );
    }
  },
  [UserRole.EMPLOYEE]
); 
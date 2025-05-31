import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { ActivityAction, EmployeeSubrole, SessionStatus, TransactionReason, UserRole } from "@/lib/enums";
import { addActivityLog } from "@/lib/activity-logger";

async function handler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { source, destination, barcode } = body;

    // Validation
    if (!source || !destination || !barcode) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Only operators can create sessions
    if (session.user.subrole !== 'OPERATOR') {
      return NextResponse.json(
        { error: "Only operators can create sessions" },
        { status: 403 }
      );
    }

    // Get operator details
    const { data: operator, error: operatorError } = await supabase
      .from('users')
      .select('*, company:companies(*)')
      .eq('id', session.user.id)
      .single();

    if (operatorError || !operator || !operator.companyId) {
      return NextResponse.json(
        { error: "Operator must belong to a company" },
        { status: 400 }
      );
    }

    // Check if operator has enough coins (minimum 1 coin needed)
    const operatorCoins = operator.coins ?? 0;
    if (operatorCoins < 1) {
      return NextResponse.json(
        { error: "Insufficient coins. You need at least 1 coin to create a session." },
        { status: 400 }
      );
    }

    // Start a Supabase transaction with multiple operations
    // We'll use a client-side transaction pattern since Supabase doesn't have server-side transactions

    // Step 1: Deduct coin from operator
    const { error: updateError } = await supabase
      .from('users')
      .update({ coins: operatorCoins - 1 })
      .eq('id', session.user.id);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update operator coins" },
        { status: 500 }
      );
    }

    // Step 2: Create the session
    const { data: newSession, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        createdById: session.user.id,
        companyId: operator.companyId,
        source,
        destination,
        status: SessionStatus.PENDING
      })
      .select()
      .single();

    if (sessionError || !newSession) {
      // Rollback coin update
      await supabase
        .from('users')
        .update({ coins: operatorCoins })
        .eq('id', session.user.id);

      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }

    // Step 3: Create the seal
    const { data: seal, error: sealError } = await supabase
      .from('seals')
      .insert({
        sessionId: newSession.id,
        barcode
      })
      .select()
      .single();

    if (sealError) {
      // Rollback previous operations
      await supabase.from('sessions').delete().eq('id', newSession.id);
      await supabase
        .from('users')
        .update({ coins: operatorCoins })
        .eq('id', session.user.id);

      return NextResponse.json(
        { error: "Failed to create seal" },
        { status: 500 }
      );
    }

    // Step 4: Create coin transaction record
    const { data: coinTransaction, error: transactionError } = await supabase
      .from('coin_transactions')
      .insert({
        fromUserId: session.user.id,
        toUserId: session.user.id, // Operator spends the coin (not transferred)
        amount: 1,
        reason: TransactionReason.SESSION_CREATION,
        reasonText: `Session ID: ${newSession.id} - From ${source} to ${destination} with barcode ${barcode}`,
        createdAt: new Date().toISOString()
      })
      .select()
      .single();

    if (transactionError) {
      // Log error but continue, as this is not critical
      console.error("Failed to create coin transaction:", transactionError);
    }

    // Log the activity
    await addActivityLog({
      userId: session.user.id,
      action: ActivityAction.CREATE,
      details: {
        entityType: "SESSION",
        sessionId: newSession.id,
        source,
        destination,
        barcode,
        cost: "1 coin"
      },
      targetResourceId: newSession.id,
      targetResourceType: "SESSION"
    });

    // Return the result with the updated session including seal
    const result = { 
      session: { ...newSession, seal },
      transaction: coinTransaction,
      operator: {
        id: operator.id,
        remainingCoins: operatorCoins - 1
      }
    };

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("Error creating session:", error);
    
    // Check for Supabase-specific errors (like duplicate constraint violations)
    if (error instanceof Error && error.message.includes('duplicate key value')) {
      return NextResponse.json(
        { error: "Duplicate barcode detected" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

// Only employees with OPERATOR subrole can create sessions
export const POST = withAuth(handler, [UserRole.EMPLOYEE]); 
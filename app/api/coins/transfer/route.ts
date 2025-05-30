import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";
import { UserRole } from "@/lib/enums";
import { addActivityLog } from "@/lib/activity-logger";
import { ActivityAction } from "@/lib/enums";

// Define transaction reasons
export enum TransactionReason {
  COIN_ALLOCATION = 'COIN_ALLOCATION',
  ADMIN_CREATION = 'ADMIN_CREATION',
  MANUAL_ADJUSTMENT = 'MANUAL_ADJUSTMENT',
  SYSTEM = 'SYSTEM'
}

async function handler(req: NextRequest) {
  if (req.method !== 'POST') {
    return NextResponse.json(
      { error: "Method not allowed" },
      { status: 405 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { fromUserId, toUserId, amount, reason, notes } = body;
    
    // If fromUserId is not provided, use the current user's ID
    const senderId = fromUserId || session.user.id;
    
    // Validate request data
    if (!toUserId) {
      return NextResponse.json(
        { error: "Recipient is required" },
        { status: 400 }
      );
    }
    
    if (!amount || isNaN(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Valid amount is required" },
        { status: 400 }
      );
    }
    
    // Cannot transfer to self
    if (senderId === toUserId) {
      return NextResponse.json(
        { error: "Cannot transfer coins to yourself" },
        { status: 400 }
      );
    }
    
    // Get detailed sender info
    const { data: sender, error: senderError } = await supabase
      .from('users')
      .select('id, name, role, coins')
      .eq('id', senderId)
      .single();
    
    if (senderError || !sender) {
      return NextResponse.json(
        { error: "Sender not found" },
        { status: 404 }
      );
    }
    
    // Get detailed recipient info
    const { data: recipient, error: recipientError } = await supabase
      .from('users')
      .select('id, name, role, coins')
      .eq('id', toUserId)
      .single();
    
    if (recipientError || !recipient) {
      return NextResponse.json(
        { error: "Recipient not found" },
        { status: 404 }
      );
    }
    
    // Check if sender has enough coins
    if (sender.coins < amount) {
      return NextResponse.json(
        { error: `Insufficient coins. You have ${sender.coins} coins, but ${amount} are needed.` },
        { status: 400 }
      );
    }
    
    // Authorize based on roles
    // SuperAdmin can transfer to anyone
    // Admin can only transfer to other users (in real implementation, would have more rules)
    let isAuthorized = false;
    
    if (session.user.role === UserRole.SUPERADMIN) {
      isAuthorized = true;
    } else if (session.user.role === UserRole.ADMIN) {
      // Add specific admin rules here if needed
      isAuthorized = true;
    }
    
    if (!isAuthorized) {
      return NextResponse.json(
        { error: "You are not authorized to transfer coins to this user." },
        { status: 403 }
      );
    }
    
    // Start a transaction to ensure both operations succeed or fail together
    // 1. Deduct coins from sender
    const { data: updatedSender, error: updateSenderError } = await supabaseAdmin
      .from('users')
      .update({ 
        coins: sender.coins - amount,
        updatedAt: new Date().toISOString()
      })
      .eq('id', senderId)
      .select('id, coins')
      .single();
    
    if (updateSenderError) {
      console.error("Error updating sender coins:", updateSenderError);
      return NextResponse.json(
        { error: "Failed to deduct coins from sender" },
        { status: 500 }
      );
    }
    
    // 2. Add coins to recipient
    const { data: updatedRecipient, error: updateRecipientError } = await supabaseAdmin
      .from('users')
      .update({
        coins: recipient.coins + amount,
        updatedAt: new Date().toISOString()
      })
      .eq('id', toUserId)
      .select('id, coins')
      .single();
    
    if (updateRecipientError) {
      // Revert the sender's coin deduction if adding to recipient fails
      await supabaseAdmin
        .from('users')
        .update({ coins: sender.coins })
        .eq('id', senderId);
      
      console.error("Error updating recipient coins:", updateRecipientError);
      return NextResponse.json(
        { error: "Failed to add coins to recipient" },
        { status: 500 }
      );
    }
    
    // 3. Record the transaction
    const transactionReason = reason || TransactionReason.COIN_ALLOCATION;
    const transactionNotes = notes || `Transfer from ${sender.name} to ${recipient.name}`;
    
    const { data: coinTransaction, error: transactionError } = await supabaseAdmin
      .from('coin_transactions')
      .insert({
        from_user_id: senderId,
        to_user_id: toUserId,
        amount: amount,
        reason: transactionReason,
        notes: transactionNotes,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (transactionError) {
      console.error("Error recording coin transaction:", transactionError);
      // Don't fail the transfer if just the transaction record fails
    }
    
    // 4. Log the activity
    try {
      await addActivityLog({
        userId: session.user.id,
        action: ActivityAction.TRANSFER,
        details: {
          amount,
          fromUserId: senderId,
          fromUserName: sender.name,
          toUserId: toUserId,
          toUserName: recipient.name,
          reason: transactionReason,
          notes: transactionNotes
        },
        targetResourceId: coinTransaction?.id,
        targetResourceType: "COIN_TRANSACTION"
      });
    } catch (logError) {
      console.error("Error logging activity:", logError);
      // Don't fail the transfer if just the activity log fails
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully transferred ${amount} coins to ${recipient.name}`,
      transaction: {
        id: coinTransaction?.id,
        amount,
        from: {
          id: senderId,
          name: sender.name
        },
        to: {
          id: toUserId,
          name: recipient.name
        },
        createdAt: new Date().toISOString()
      },
      senderBalance: updatedSender.coins,
      recipientBalance: updatedRecipient.coins
    });
  } catch (error) {
    console.error("Error transferring coins:", error);
    return NextResponse.json(
      { error: "Failed to transfer coins", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Allow SuperAdmin and Admin to transfer coins
export const POST = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN
]); 
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function POST(req: NextRequest) {
  try {
    // Verify authorization
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== 'SUPERADMIN') {
      return NextResponse.json(
        { error: "Only SuperAdmin can access this endpoint" },
        { status: 403 }
      );
    }
    
    // Find SuperAdmin user
    const { data: superAdmin, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'superadmin@cbums.com')
      .eq('role', 'SUPERADMIN')
      .single();
    
    if (findError) {
      console.error('Error finding SuperAdmin:', findError);
      return NextResponse.json(
        { error: `Failed to find SuperAdmin: ${findError.message}` },
        { status: 500 }
      );
    }
    
    if (!superAdmin) {
      return NextResponse.json(
        { error: "SuperAdmin not found in database" },
        { status: 404 }
      );
    }
    
    // Calculate adjustment amount
    const newCoins = 1000000;
    const currentCoins = superAdmin.coins || 0;
    const adjustment = newCoins - currentCoins;
    
    if (adjustment === 0) {
      return NextResponse.json({
        success: true,
        message: `SuperAdmin coins already at ${newCoins}`,
        adjustment: 0
      });
    }
    
    // Update SuperAdmin coins
    const { error: updateError } = await supabase
      .from('users')
      .update({ coins: newCoins })
      .eq('id', superAdmin.id);
    
    if (updateError) {
      console.error('Error updating SuperAdmin coins:', updateError);
      return NextResponse.json(
        { error: `Failed to update SuperAdmin coins: ${updateError.message}` },
        { status: 500 }
      );
    }
    
    // Record the transaction
    const now = new Date().toISOString();
    
    const { data: transaction, error: transactionError } = await supabase
      .from('coin_transactions')
      .insert({
        from_user_id: superAdmin.id,
        to_user_id: superAdmin.id,
        amount: Math.abs(adjustment),
        reason: 'SYSTEM',
        notes: 'System balance adjustment',
        created_at: now,
        updated_at: now
      })
      .select()
      .single();
    
    if (transactionError) {
      console.error('Error recording transaction:', transactionError);
      // Don't fail the request if just the transaction record fails
    }
    
    return NextResponse.json({
      success: true,
      message: `SuperAdmin coins updated to ${newCoins}`,
      previousCoins: currentCoins,
      newCoins: newCoins,
      adjustment: adjustment,
      transactionId: transaction?.id
    });
  } catch (error) {
    console.error('Error fixing SuperAdmin:', error);
    return NextResponse.json(
      { error: "Failed to fix SuperAdmin coins" },
      { status: 500 }
    );
  }
}

// GET endpoint to check current SuperAdmin coins
export async function GET(req: NextRequest) {
  try {
    // Verify authorization
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    // Find SuperAdmin user
    const { data: superAdmin, error: findError } = await supabase
      .from('users')
      .select('id, name, email, role, coins')
      .eq('email', 'superadmin@cbums.com')
      .eq('role', 'SUPERADMIN')
      .single();
    
    if (findError) {
      console.error('Error finding SuperAdmin:', findError);
      return NextResponse.json(
        { error: `Failed to find SuperAdmin: ${findError.message}` },
        { status: 500 }
      );
    }
    
    if (!superAdmin) {
      return NextResponse.json(
        { error: "SuperAdmin not found in database" },
        { status: 404 }
      );
    }
    
    // Get recent transactions
    const { data: transactionsData, error: transactionsError } = await supabase
      .from('coin_transactions')
      .select('*')
      .or(`from_user_id.eq.${superAdmin.id},to_user_id.eq.${superAdmin.id}`)
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (transactionsError) {
      console.error('Error fetching transactions:', transactionsError);
    }
    
    // Collect all user IDs from transactions
    const userIds = new Set<string>();
    if (transactionsData) {
      transactionsData.forEach(transaction => {
        if (transaction.from_user_id) userIds.add(transaction.from_user_id);
        if (transaction.to_user_id) userIds.add(transaction.to_user_id);
      });
    }
    
    // Fetch user details separately
    const { data: usersData, error: usersError } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', Array.from(userIds));
    
    if (usersError) {
      console.error('Error fetching user details for transactions:', usersError);
    }
    
    // Create a map of user id to user details
    const userMap = new Map();
    if (usersData) {
      usersData.forEach(user => {
        userMap.set(user.id, user);
      });
    }
    
    // Combine transaction data with user details
    const transactions = transactionsData?.map(transaction => ({
      ...transaction,
      fromUser: transaction.from_user_id ? userMap.get(transaction.from_user_id) : null,
      toUser: transaction.to_user_id ? userMap.get(transaction.to_user_id) : null,
    })) || [];
    
    return NextResponse.json({
      superAdmin,
      transactions: transactions,
      needsAdjustment: superAdmin.coins < 1000000
    });
  } catch (error) {
    console.error('Error checking SuperAdmin:', error);
    return NextResponse.json(
      { error: "Failed to check SuperAdmin coins" },
      { status: 500 }
    );
  }
} 
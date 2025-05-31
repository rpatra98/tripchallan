import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/lib/enums";

async function handler(req: NextRequest) {
  try {
    // Get query parameters
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const userId = url.searchParams.get('userId');
    
    // Build query - use snake_case column names for consistent querying
    let query = supabase
      .from('coin_transactions')
      .select(`
        *,
        fromUser:users!coin_transactions_from_user_id_fkey(id, name, email),
        toUser:users!coin_transactions_to_user_id_fkey(id, name, email)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)
      .range(offset, offset + limit - 1);
    
    // Add user filter if specified using snake_case columns
    if (userId) {
      query = query.or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`);
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error("Error fetching coin transactions:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    // Transform the data to include both snake_case and camelCase formats for backward compatibility
    const transactions = data?.map(transaction => ({
      id: transaction.id,
      amount: transaction.amount,
      // Use snake_case columns as the source of truth and map to camelCase
      fromUserId: transaction.from_user_id,
      toUserId: transaction.to_user_id,
      from_user_id: transaction.from_user_id,
      to_user_id: transaction.to_user_id,
      reason: transaction.reason,
      reasonText: transaction.reasonText || null,
      notes: transaction.notes,
      // Map dates properly
      createdAt: transaction.created_at,
      updatedAt: transaction.updated_at,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
      // Include user data
      fromUser: transaction.fromUser,
      toUser: transaction.toUser
    })) || [];
    
    return NextResponse.json({
      transactions,
      count,
      pagination: {
        page: Math.floor(offset / limit) + 1,
        limit,
        totalItems: count || 0,
        totalPages: count ? Math.ceil(count / limit) : 0,
        hasNextPage: count ? offset + limit < count : false,
        hasPrevPage: offset > 0
      }
    });
  } catch (error: unknown) {
    console.error("Error fetching coin transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch coin transactions" },
      { status: 500 }
    );
  }
}

// SuperAdmin and Admin can view transaction history
export const GET = withAuth(handler, [UserRole.SUPERADMIN, UserRole.ADMIN]); 
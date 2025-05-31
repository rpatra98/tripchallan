import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import supabase from "@/lib/supabase";
import { UserRole } from "@/lib/enums";

async function handler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    // Get user ID from query params or use the current user's ID
    const url = new URL(req.url);
    const userId = url.searchParams.get('userId') || session.user.id;
    
    // If requesting another user's balance, check permissions
    if (userId !== session.user.id && session.user.role !== UserRole.SUPERADMIN) {
      return NextResponse.json(
        { error: "You don't have permission to view this user's balance" },
        { status: 403 }
      );
    }
    
    // Fetch the user's coin balance
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, coins')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error("Error fetching user balance:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
        id: user.id,
        name: user.name,
        email: user.email,
      coins: user.coins || 0
    });
  } catch (error: unknown) {
    console.error("Error fetching user balance:", error);
    return NextResponse.json(
      { error: "Failed to fetch user balance" },
      { status: 500 }
    );
  }
}

// All authenticated users can access their own balance
// SuperAdmin can access any user's balance
export const GET = withAuth(handler, [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.EMPLOYEE]); 
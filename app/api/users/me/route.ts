import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import supabase from "@/lib/supabase";

// Remove the withAuth wrapper to diagnose session issues
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Fetch user data from Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, coins')
      .eq('id', session.user.id)
      .single();
    
    if (error) {
      console.error("Error fetching user data:", error);
      
      // For SuperAdmin, provide default values if fetch fails
      if (session.user.role === 'SUPERADMIN') {
        return NextResponse.json({
          id: session.user.id,
          name: 'Super Admin',
          email: session.user.email,
          role: 'SUPERADMIN',
          coins: 1000000
        });
      }
      
      return NextResponse.json(
        { error: "Failed to fetch user data" },
        { status: 500 }
      );
    }
    
    // If user not found but we have session data
    if (!user && session.user.id) {
      // For SuperAdmin, provide default values
      if (session.user.role === 'SUPERADMIN') {
        return NextResponse.json({
          id: session.user.id,
          name: 'Super Admin',
          email: session.user.email,
          role: 'SUPERADMIN',
          coins: 1000000
        });
      }
      
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json(user);
  } catch (error) {
    console.error("Error in /api/users/me:", error);
    return NextResponse.json(
      { error: "Failed to get user data" },
      { status: 500 }
    );
  }
} 
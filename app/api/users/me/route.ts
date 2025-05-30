import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import supabase from "@/lib/supabase";

export const GET = withAuth(
  async () => {
    try {
      const session = await getServerSession(authOptions);
      
      if (!session || !session.user) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        );
      }
      
      // Get user details with company info using Supabase
      const { data: user, error } = await supabase
        .from('users')
        .select(`
          *,
          company:companies(*)
        `)
        .eq('id', session.user.id)
        .single();
      
      if (error) {
        console.error("Error fetching user from Supabase:", error);
        return NextResponse.json(
          { error: "User not found", details: error.message },
          { status: 404 }
        );
      }
      
      if (!user) {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
      
      // Remove sensitive fields
      const { password, ...userWithoutPassword } = user;
      
      return NextResponse.json(userWithoutPassword);
    } catch (error) {
      console.error("Error fetching user details:", error);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return NextResponse.json(
        { error: "Failed to fetch user details", details: errorMessage },
        { status: 500 }
      );
    }
  },
  ["SUPERADMIN", "ADMIN", "COMPANY", "EMPLOYEE"]
); 
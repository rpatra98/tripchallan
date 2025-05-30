import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import supabase from "@/lib/supabase";

// Remove the withAuth wrapper to diagnose session issues
export async function GET(req: NextRequest) {
  try {
    console.log("API /users/me called");
    const session = await getServerSession(authOptions);
    
    console.log("Session in /api/users/me:", session ? "Valid session" : "No session", 
                "User:", session?.user?.email,
                "Role:", session?.user?.role);
    
    if (!session || !session.user) {
      console.error("No valid session found in /api/users/me");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    // For SuperAdmin with hardcoded ID, handle specially
    if (session.user.role === 'SUPERADMIN' && session.user.id === "00000000-0000-0000-0000-000000000000") {
      console.log("SuperAdmin with emergency ID detected, returning hardcoded data");
      return NextResponse.json({
        id: "00000000-0000-0000-0000-000000000000",
        name: "Super Admin",
        email: "superadmin@cbums.com",
        role: "SUPERADMIN",
        subrole: null,
        companyId: null,
        coins: 1000000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    console.log("Fetching user details from Supabase for ID:", session.user.id);
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
      
      // If SuperAdmin and DB error, return hardcoded data
      if (session.user.role === 'SUPERADMIN') {
        console.log("SuperAdmin with DB error, returning hardcoded data");
        return NextResponse.json({
          id: session.user.id,
          name: session.user.name || "Super Admin",
          email: session.user.email || "superadmin@cbums.com",
          role: "SUPERADMIN",
          subrole: null,
          companyId: null,
          coins: session.user.coins || 1000000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      return NextResponse.json(
        { error: "User not found", details: error.message },
        { status: 404 }
      );
    }
    
    if (!user) {
      console.error("User not found in database:", session.user.id);
      
      // If SuperAdmin and user not found, return hardcoded data
      if (session.user.role === 'SUPERADMIN') {
        console.log("SuperAdmin not found in DB, returning session data");
        return NextResponse.json({
          id: session.user.id,
          name: session.user.name || "Super Admin",
          email: session.user.email || "superadmin@cbums.com",
          role: "SUPERADMIN",
          subrole: null,
          companyId: null,
          coins: session.user.coins || 1000000,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    console.log("User found in Supabase:", user.id);
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
} 
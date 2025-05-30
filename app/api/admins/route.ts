import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import supabase from "@/lib/supabase";
import { UserRole } from "@/lib/enums";

async function handler() {
  try {
    // Fetch all admin users using Supabase
    const { data, error } = await supabase
      .from('users')
      .select(`
        id, 
        name, 
        email, 
        role, 
        coins, 
        createdAt, 
        updatedAt
      `)
      .eq('role', UserRole.ADMIN)
      .order('createdAt', { ascending: false });
    
    if (error) {
      console.error("Error fetching admin users:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Return the admin list directly without createdUsers/hasCreatedResources
    return NextResponse.json({ admins: data });
  } catch (error: unknown) {
    console.error("Error fetching admin users:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin users" },
      { status: 500 }
    );
  }
}

// Only SuperAdmin can access list of admins
export const GET = withAuth(handler, [UserRole.SUPERADMIN]); 
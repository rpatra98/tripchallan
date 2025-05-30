import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
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
        updatedAt,
        createdUsers:users!users_createdById_fkey(id)
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

    // Process the data to include hasCreatedResources
    const admins = data.map(admin => ({
      ...admin,
      hasCreatedResources: admin.createdUsers ? admin.createdUsers.length > 0 : false
    }));

    return NextResponse.json({ admins });
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
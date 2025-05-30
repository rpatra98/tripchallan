import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";
import { UserRole } from "@/lib/enums";

type RouteHandlerContext = {
  params: Record<string, string>;
};

// GET admin by ID
async function getHandler(
  req: NextRequest,
  context?: RouteHandlerContext
) {
  try {
    if (!context || !context.params.id) {
      return NextResponse.json(
        { error: "Admin ID is required" },
        { status: 400 }
      );
    }

    const id = context.params.id;

    // Get admin by ID
    const { data: admin, error } = await supabase
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
      .eq('id', id)
      .eq('role', UserRole.ADMIN)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: "Admin not found" },
          { status: 404 }
        );
      }
      
      console.error("Error fetching admin:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ admin });
  } catch (error: unknown) {
    console.error("Error fetching admin:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin" },
      { status: 500 }
    );
  }
}

// DELETE admin by ID
async function deleteHandler(
  req: NextRequest,
  context?: RouteHandlerContext
) {
  try {
    if (!context || !context.params.id) {
      return NextResponse.json(
        { error: "Admin ID is required" },
        { status: 400 }
      );
    }

    const id = context.params.id;

    // First check if this admin has created any resources
    const { data: resources, error: countError } = await supabase
      .from('users')
      .select('id')
      .eq('createdById', id)
      .limit(1);

    if (countError) {
      console.error("Error checking admin resources:", countError);
      return NextResponse.json(
        { error: "Failed to check admin resources" },
        { status: 500 }
      );
    }

    // If admin has created resources, don't delete
    if (resources && resources.length > 0) {
      return NextResponse.json(
        { 
          error: "Cannot delete admin with associated resources", 
          resourceCount: resources.length 
        },
        { status: 400 }
      );
    }

    // Delete the admin
    const { error: deleteError } = await supabaseAdmin
      .from('users')
      .delete()
      .eq('id', id)
      .eq('role', UserRole.ADMIN);

    if (deleteError) {
      console.error("Error deleting admin:", deleteError);
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("Error deleting admin:", error);
    return NextResponse.json(
      { error: "Failed to delete admin" },
      { status: 500 }
    );
  }
}

// PATCH/PUT admin by ID
async function updateHandler(
  req: NextRequest,
  context?: RouteHandlerContext
) {
  try {
    if (!context || !context.params.id) {
      return NextResponse.json(
        { error: "Admin ID is required" },
        { status: 400 }
      );
    }

    const id = context.params.id;
    const body = await req.json();
    const { name, email, coins } = body;

    // Validate the data
    if (!name && !email && coins === undefined) {
      return NextResponse.json(
        { error: "No data provided for update" },
        { status: 400 }
      );
    }

    // Check if email is taken by another user
    if (email) {
      const { data: existingUser, error: checkError } = await supabase
        .from('users')
        .select('id')
        .eq('email', email)
        .neq('id', id)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error("Error checking email uniqueness:", checkError);
        return NextResponse.json(
          { error: "Failed to validate email uniqueness" },
          { status: 500 }
        );
      }

      if (existingUser) {
        return NextResponse.json(
          { error: "Email already in use" },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (coins !== undefined) updateData.coins = coins;

    // Update the admin
    const { data: updatedAdmin, error: updateError } = await supabaseAdmin
      .from('users')
      .update(updateData)
      .eq('id', id)
      .eq('role', UserRole.ADMIN)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating admin:", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ admin: updatedAdmin });
  } catch (error: unknown) {
    console.error("Error updating admin:", error);
    return NextResponse.json(
      { error: "Failed to update admin" },
      { status: 500 }
    );
  }
}

// Only SuperAdmin can access admin endpoints
export const GET = withAuth(getHandler, [UserRole.SUPERADMIN]);
export const DELETE = withAuth(deleteHandler, [UserRole.SUPERADMIN]);
export const PATCH = withAuth(updateHandler, [UserRole.SUPERADMIN]);
export const PUT = withAuth(updateHandler, [UserRole.SUPERADMIN]); 
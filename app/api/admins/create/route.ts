import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/lib/enums";
import * as bcrypt from "bcrypt";
import { ActivityAction } from "@/lib/enums";
import { addActivityLog } from "@/lib/activity-logger";

async function handler(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, coins = 0 } = body;
    
    // Get the current session/user making the request
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData?.session;

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Get SuperAdmin user details to check coins
    const { data: superAdmin, error: superAdminError } = await supabase
      .from('users')
      .select('id, coins')
      .eq('email', 'superadmin@cbums.com')
      .single();

    if (superAdminError) {
      console.error("Error fetching SuperAdmin:", superAdminError);
      return NextResponse.json(
        { error: "Failed to verify SuperAdmin balance" },
        { status: 500 }
      );
    }

    // Check if SuperAdmin has enough coins
    if (superAdmin.coins < coins) {
      return NextResponse.json(
        { error: `Insufficient coins. You have ${superAdmin.coins} coins, but ${coins} are needed.` },
        { status: 400 }
      );
    }

    // Check if email already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 is "not found" which is what we want
      console.error("Error checking for existing user:", checkError);
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

    // Start a transaction to ensure both operations succeed or fail together
    // First deduct coins from SuperAdmin
    const { data: updatedSuperAdmin, error: updateError } = await supabase
      .from('users')
      .update({ 
        coins: superAdmin.coins - coins,
        updatedAt: new Date().toISOString()
      })
      .eq('id', superAdmin.id)
      .select('coins')
      .single();

    if (updateError) {
      console.error("Error updating SuperAdmin coins:", updateError);
      return NextResponse.json(
        { error: "Failed to allocate coins from SuperAdmin" },
        { status: 500 }
      );
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create the admin user
    const { data: newAdmin, error: createError } = await supabase
      .from('users')
      .insert({
        name,
        email,
        password: hashedPassword,
        role: UserRole.ADMIN,
        coins,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdById: superAdmin.id
      })
      .select()
      .single();

    if (createError) {
      // If admin creation fails, revert the coin deduction
      await supabase
        .from('users')
        .update({ coins: superAdmin.coins })
        .eq('id', superAdmin.id);

      console.error("Error creating admin:", createError);
      return NextResponse.json(
        { error: createError.message },
        { status: 500 }
      );
    }

    // Log the activity
    try {
      await addActivityLog({
        userId: superAdmin.id,
        action: ActivityAction.CREATE,
        targetResourceType: 'Admin',
        targetResourceId: newAdmin.id,
        details: {
          name: newAdmin.name,
          email: newAdmin.email,
          coinsAllocated: coins
        }
      });
    } catch (logError) {
      console.error("Error logging activity:", logError);
      // Don't fail the request if logging fails
    }

    // Return the new admin without the password and with updated SuperAdmin coins
    const { password: _, ...adminWithoutPassword } = newAdmin;
    return NextResponse.json({
      admin: adminWithoutPassword,
      superAdminCoins: updatedSuperAdmin.coins
    }, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating admin:", error);
    return NextResponse.json(
      { error: "Failed to create admin" },
      { status: 500 }
    );
  }
}

// Only SuperAdmin can create admins
export const POST = withAuth(handler, [UserRole.SUPERADMIN]); 
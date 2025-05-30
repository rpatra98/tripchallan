import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import supabase from "@/lib/supabase";
import supabaseAdmin from "@/lib/supabase-admin";
import { UserRole } from "@/lib/enums";
import * as bcrypt from "bcrypt";
import { ActivityAction } from "@/lib/enums";
import { addActivityLog } from "@/lib/activity-logger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

async function handler(req: NextRequest) {
  try {
    console.log("Admin creation handler - starting request");
    
    // Get session from NextAuth instead of Supabase
    const session = await getServerSession(authOptions);
    console.log("Session obtained:", session ? "Yes" : "No", "User:", session?.user?.email);
    
    if (!session || !session.user) {
      console.log("Authentication failed: No session or user");
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // Make sure this is the SuperAdmin
    if (session.user.role !== UserRole.SUPERADMIN) {
      console.log(`Authorization failed: User role ${session.user.role} is not SUPERADMIN`);
      return NextResponse.json(
        { error: "Only SuperAdmin can create admin users" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, email, password, coins = 0 } = body;
    console.log("Request body parsed:", { name, email, passwordLength: password?.length, coins });

    // Validate required fields
    if (!name || !email || !password) {
      console.log("Validation failed: Missing required fields");
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    // Get SuperAdmin user details to check coins - using regular client for read operation is fine
    console.log("Fetching SuperAdmin details for email:", session.user.email);
    const { data: superAdmin, error: superAdminError } = await supabase
      .from('users')
      .select('id, email, coins')
      .eq('email', session.user.email)
      .single();

    if (superAdminError) {
      console.error("Error fetching SuperAdmin:", superAdminError);
      return NextResponse.json(
        { error: "Failed to verify SuperAdmin balance", details: superAdminError.message },
        { status: 500 }
      );
    }

    if (!superAdmin) {
      console.error("SuperAdmin not found for email:", session.user.email);
      return NextResponse.json(
        { error: "SuperAdmin user not found in database" },
        { status: 404 }
      );
    }

    console.log("SuperAdmin found:", superAdmin.id, "Email:", superAdmin.email, "Coins:", superAdmin.coins);

    // Check if SuperAdmin has enough coins
    if (superAdmin.coins < coins) {
      console.log(`Insufficient coins: ${superAdmin.coins} available, ${coins} requested`);
      return NextResponse.json(
        { error: `Insufficient coins. You have ${superAdmin.coins} coins, but ${coins} are needed.` },
        { status: 400 }
      );
    }

    // Check if email already exists
    console.log("Checking if email already exists:", email);
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
      console.log("Email already in use:", email);
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 400 }
      );
    }

    // Start a transaction to ensure both operations succeed or fail together
    // First deduct coins from SuperAdmin - use admin client for write operations
    console.log("Deducting coins from SuperAdmin:", coins);
    console.log("SuperAdmin current coins:", superAdmin.coins);
    console.log("New balance will be:", superAdmin.coins - coins);
    
    // Debug statement to log the exact update operation
    const newCoinBalance = superAdmin.coins - coins;
    console.log("UPDATE users SET coins =", newCoinBalance, "WHERE id =", superAdmin.id);
    
    try {
      const { data: updatedSuperAdmin, error: updateError } = await supabaseAdmin
        .from('users')
        .update({ 
          coins: newCoinBalance,
          updatedAt: new Date().toISOString()
        })
        .eq('id', superAdmin.id)
        .select('id, coins')
        .single();

      if (updateError) {
        console.error("Error updating SuperAdmin coins:", updateError);
        console.error("Error code:", updateError.code);
        console.error("Error message:", updateError.message);
        console.error("Error details:", updateError.details);
        return NextResponse.json(
          { 
            error: "Failed to allocate coins from SuperAdmin", 
            details: updateError.message,
            code: updateError.code
          },
          { status: 500 }
        );
      }

      if (!updatedSuperAdmin) {
        console.error("Update succeeded but no data returned");
        return NextResponse.json(
          { error: "Failed to update SuperAdmin coins: No data returned" },
          { status: 500 }
        );
      }

      console.log("SuperAdmin coins updated. New balance:", updatedSuperAdmin.coins);

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 12);
      console.log("Password hashed successfully");

      // Create the admin user - removed 'active' field which doesn't exist in the schema
      console.log("Creating new admin user");
      const { data: newAdmin, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          name,
          email,
          password: hashedPassword,
          role: UserRole.ADMIN,
          coins,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdById: superAdmin.id
        })
        .select()
        .single();

      if (createError) {
        // If admin creation fails, revert the coin deduction
        console.error("Error creating admin:", createError);
        console.log("Reverting coin deduction due to error");
        
        const { error: revertError } = await supabaseAdmin
          .from('users')
          .update({ coins: superAdmin.coins })
          .eq('id', superAdmin.id);
          
        if (revertError) {
          console.error("Failed to revert coin deduction:", revertError);
        }

        return NextResponse.json(
          { error: createError.message },
          { status: 500 }
        );
      }

      console.log("Admin created successfully:", newAdmin.id);

      // Log the activity
      try {
        console.log("Logging admin creation activity");
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
      console.log("Admin creation successful. Returning response with new SuperAdmin balance:", updatedSuperAdmin.coins);
      return NextResponse.json({
        admin: adminWithoutPassword,
        superAdminCoins: updatedSuperAdmin.coins
      }, { status: 201 });
    } catch (updateException) {
      console.error("Exception during coin update:", updateException);
      return NextResponse.json(
        { error: "Failed to allocate coins from SuperAdmin due to an exception", details: String(updateException) },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("Unexpected error in admin creation:", error);
    return NextResponse.json(
      { error: "Failed to create admin", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Only SuperAdmin can create admins
export const POST = withAuth(handler, [UserRole.SUPERADMIN]); 
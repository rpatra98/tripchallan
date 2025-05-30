import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/lib/enums";
import * as bcrypt from "bcrypt";

async function handler(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, coins = 0 } = body;

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
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
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating admin:", createError);
      return NextResponse.json(
        { error: createError.message },
        { status: 500 }
      );
    }

    // Return the new admin without the password
    const { password: _, ...adminWithoutPassword } = newAdmin;
    return NextResponse.json({ admin: adminWithoutPassword }, { status: 201 });
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
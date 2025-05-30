import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { UserRole } from "@/lib/enums";
import supabase from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    // Check authentication and authorization
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Only SuperAdmin can update their coins
    if (session.user.email !== "superadmin@cbums.com") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    
    // Parse request body
    const body = await req.json();
    const { amount } = body;
    
    if (typeof amount !== 'number' || amount < 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    
    // First check if SuperAdmin exists
    const { data: user, error: findError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'superadmin@cbums.com')
      .single();
    
    if (findError) {
      console.error("Error finding SuperAdmin:", findError);
      
      // If SuperAdmin doesn't exist, create them
      if (findError.code === 'PGRST116') {
        const { data: newUser, error: createError } = await supabase
          .from('users')
          .insert({
            name: 'Super Admin',
            email: 'superadmin@cbums.com',
            password: '$2b$12$oH4GGXGQCRZBCw5dUJ1PU.SZAP6OjL62a03TzSyznK2Lp4J0ppHSy', // hashed 'superadmin123'
            role: 'SUPERADMIN',
            coins: amount,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
          .select()
          .single();
        
        if (createError) {
          console.error("Error creating SuperAdmin:", createError);
          return NextResponse.json({ error: "Failed to create SuperAdmin" }, { status: 500 });
        }
        
        return NextResponse.json({ 
          message: "SuperAdmin created with coins", 
          success: true,
          userId: newUser.id,
          coins: amount
        });
      }
      
      return NextResponse.json({ error: "Failed to find SuperAdmin" }, { status: 500 });
    }
    
    // Update the SuperAdmin's coins
    const { data: updatedUser, error: updateError } = await supabase
      .from('users')
      .update({ coins: amount })
      .eq('email', 'superadmin@cbums.com')
      .select()
      .single();
    
    if (updateError) {
      console.error("Error updating SuperAdmin coins:", updateError);
      return NextResponse.json({ error: "Failed to update coins" }, { status: 500 });
    }
    
    return NextResponse.json({ 
      message: "Coins updated successfully", 
      success: true,
      userId: updatedUser.id,
      coins: amount
    });
    
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 
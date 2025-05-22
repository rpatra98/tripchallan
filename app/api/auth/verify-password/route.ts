import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { compare } from "bcrypt";

export async function POST(req: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    
    const { password } = await req.json();
    
    if (!password) {
      return NextResponse.json(
        { error: "Password is required" },
        { status: 400 }
      );
    }
    
    // Get user from database with hashed password
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    });
    
    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }
    
    // Compare provided password with stored hash
    const passwordsMatch = await compare(password, user.password);
    
    if (!passwordsMatch) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 401 }
      );
    }
    
    // Password is correct
    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error("Password verification error:", error);
    return NextResponse.json(
      { error: "An error occurred during password verification" },
      { status: 500 }
    );
  }
} 
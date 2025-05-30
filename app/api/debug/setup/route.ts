import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Only allow SuperAdmin to access this endpoint
    if (session.user.email !== "superadmin@cbums.com") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    
    // Run the database initialization script
    try {
      const { stdout, stderr } = await execPromise('npm run db:init');
      
      if (stderr) {
        console.log('Database setup stderr:', stderr);
      }
      
      return NextResponse.json({ 
        message: "Database reset completed successfully", 
        success: true,
        details: stdout.substring(0, 1000) // Limit the output size
      });
    } catch (execError: any) {
      console.error("Error executing database setup:", execError);
      return NextResponse.json({ 
        error: "Database setup failed", 
        details: execError.message 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 
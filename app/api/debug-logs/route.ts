import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { UserRole, ActivityAction } from "@/lib/enums";
import { addActivityLog } from "@/lib/activity-logger";
import { supabase } from "@/lib/supabase";

/**
 * Debug endpoint to check and create activity logs
 * Only accessible to SUPERADMIN users
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== UserRole.SUPERADMIN) {
      return NextResponse.json({ error: "Unauthorized. Only SUPERADMIN can access this endpoint." }, { status: 401 });
    }
    
    // Check if there are any activity logs in the database
    const logCount = await supabase.from('activity_logs').count();
    
    // Create sample activity logs if requested by query param
    const url = new URL(req.url);
    const createSample = url.searchParams.get("createSample") === "true";
    
    let createdLogs = [];
    
    if (createSample) {
      // Create sample activity logs for testing
      const sampleLogs = [
        // Login activity
        {
          userId: session.user.id,
          action: ActivityAction.LOGIN,
          details: { device: "desktop" },
          userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        },
        // Create user activity
        {
          userId: session.user.id,
          action: ActivityAction.CREATE,
          targetResourceType: "USER",
          details: { 
            userName: "Test User", 
            userEmail: "test@example.com",
            userRole: "EMPLOYEE" 
          }
        },
        // Create company activity
        {
          userId: session.user.id,
          action: ActivityAction.CREATE,
          targetResourceType: "COMPANY",
          details: { 
            companyName: "Test Company", 
            companyEmail: "company@example.com" 
          }
        },
        // Update activity
        {
          userId: session.user.id,
          action: ActivityAction.UPDATE,
          targetResourceType: "USER",
          details: { 
            userName: "Updated User", 
            summaryText: "Updated user profile information" 
          }
        },
        // Allocation activity
        {
          userId: session.user.id,
          action: ActivityAction.ALLOCATE,
          targetResourceType: "COINS",
          details: { 
            amount: 100, 
            recipientName: "Test User" 
          }
        }
      ];
      
      // Create the sample logs
      for (const logData of sampleLogs) {
        const log = await addActivityLog(logData);
        if (log) {
          createdLogs.push(log);
        }
      }
    }
    
    return NextResponse.json({
      existingLogCount: logCount,
      createdSampleLogs: createSample ? createdLogs.length : 0,
      createdLogs: createSample ? createdLogs : []
    });
  } catch (error) {
    console.error("Error in debug-logs endpoint:", error);
    return NextResponse.json(
      { error: "Failed to process debug logs request" },
      { status: 500 }
    );
  }
} 
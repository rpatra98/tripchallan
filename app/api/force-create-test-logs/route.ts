import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { UserRole, ActivityAction } from "@/lib/enums";
import { supabase } from "@/lib/supabase";

/**
 * API endpoint to force-create test logs for testing
 * This is only accessible to SUPERADMIN users
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== UserRole.SUPERADMIN) {
      return NextResponse.json({ error: "Unauthorized. Only SUPERADMIN can access this endpoint." }, { status: 401 });
    }
    
    console.log('Creating test activity logs...');
    
    // Create sample test logs
    const createdLogs = [];
    
    // Sample logs to create
    const testLogs = [
      // Login activity
      {
        userId: session.user.id,
        action: ActivityAction.LOGIN,
        details: { device: 'desktop' },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      // Create user activity
      {
        userId: session.user.id,
        action: ActivityAction.CREATE,
        targetResourceType: 'USER',
        targetResourceId: 'test-user-123',
        details: { 
          userName: 'Test User', 
          userEmail: 'test@example.com',
          userRole: 'EMPLOYEE' 
        }
      },
      // View activity
      {
        userId: session.user.id,
        action: ActivityAction.VIEW,
        targetResourceType: 'USER_LIST',
        details: { 
          filters: { role: 'EMPLOYEE' },
          resultCount: 10
        }
      },
      // Update activity
      {
        userId: session.user.id,
        action: ActivityAction.UPDATE,
        targetResourceType: 'USER',
        targetResourceId: 'test-user-456',
        details: { 
          userName: 'Updated User', 
          summaryText: 'Updated user profile information' 
        }
      },
      // Transaction activity
      {
        userId: session.user.id,
        action: ActivityAction.ALLOCATE,
        targetResourceType: 'COINS',
        targetResourceId: 'transaction-123',
        details: { 
          amount: 100, 
          recipientName: 'Test User' 
        }
      }
    ];
    
    // Create each test log
    for (const logData of testLogs) {
      const { data: log, error: insertError } = await supabase
        .from('activityLogs')
        .insert(logData)
        .select();

      if (insertError) {
        console.error('Error creating test log:', insertError);
        continue;
      }

      createdLogs.push(log);
      console.log(`Created activity log: ${logData.action}`);
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdLogs.length} test logs`,
      logs: createdLogs
    });
  } catch (error) {
    console.error('Error creating test logs:', error);
    return NextResponse.json(
      { error: 'Failed to create test logs', details: String(error) },
      { status: 500 }
    );
  }
} 
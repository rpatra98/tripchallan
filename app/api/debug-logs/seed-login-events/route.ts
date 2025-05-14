import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { UserRole, ActivityAction } from "@/prisma/enums";
import { addActivityLog } from "@/lib/activity-logger";
import prisma from "@/lib/prisma";

/**
 * Debug endpoint to seed login and logout events for all users
 * This is useful for testing the activity logs dashboard
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    // Only allow superadmin to run this seed utility
    if (!session?.user || session.user.role !== UserRole.SUPERADMIN) {
      return NextResponse.json({ error: "Unauthorized. Only SUPERADMIN can access this utility." }, { status: 401 });
    }
    
    // Get all users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      }
    });
    
    const results = [];
    
    // Generate login and logout events for each user
    for (const user of users) {
      // Create a login event from desktop
      const loginDesktop = await addActivityLog({
        userId: user.id,
        action: ActivityAction.LOGIN,
        details: {
          method: "credentials",
          device: "desktop",
          deviceDetails: {
            type: "desktop",
            isMobile: false
          }
        },
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      });
      
      // Create a login event from mobile
      const loginMobile = await addActivityLog({
        userId: user.id,
        action: ActivityAction.LOGIN,
        details: {
          method: "credentials",
          device: "mobile",
          deviceDetails: {
            type: "mobile",
            isMobile: true
          }
        },
        ipAddress: "192.168.1.2",
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1"
      });
      
      // Create a logout event
      const logout = await addActivityLog({
        userId: user.id,
        action: ActivityAction.LOGOUT,
        details: {
          method: "client-side",
          device: "desktop",
          deviceDetails: {
            type: "desktop",
            isMobile: false
          }
        },
        ipAddress: "192.168.1.1",
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      });
      
      results.push({
        user: `${user.name} (${user.email})`,
        loginDesktop: !!loginDesktop,
        loginMobile: !!loginMobile,
        logout: !!logout
      });
    }
    
    return NextResponse.json({
      success: true,
      message: `Created test login/logout activities for ${users.length} users`,
      results
    });
  } catch (error) {
    console.error("Error creating test login/logout activities:", error);
    return NextResponse.json(
      { error: "Failed to create test activities", details: String(error) },
      { status: 500 }
    );
  }
} 
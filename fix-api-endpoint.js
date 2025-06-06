const fs = require('fs');
const path = require('path');

// Create the debug activity logs API endpoint
const debugApiPath = path.join('app', 'api', 'debug-activity-logs', 'route.ts');
// Create directory if it doesn't exist
fs.mkdirSync(path.dirname(debugApiPath), { recursive: true });

const debugApiContent = `import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { UserRole } from "@/prisma/enums";
import prisma from "@/lib/prisma";

/**
 * Debug endpoint to directly fetch activity logs for testing
 * This bypasses all permission checks and only accessible to SUPERADMIN users
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== UserRole.SUPERADMIN) {
      return NextResponse.json({ error: "Unauthorized. Only SUPERADMIN can access this endpoint." }, { status: 401 });
    }
    
    // Parse query parameters
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    
    // Direct database query without any filtering
    const skip = (page - 1) * limit;
    
    const [logs, totalCount] = await Promise.all([
      prisma.activityLog.findMany({
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          targetUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      }),
      prisma.activityLog.count(),
    ]);
    
    console.log(\`Debug activity logs endpoint: Found \${logs.length} logs directly from database\`);
    
    if (logs.length === 0) {
      // Try to determine if there are any logs at all in the database
      const anyLogs = await prisma.activityLog.findFirst({
        select: { id: true }
      });
      
      if (!anyLogs) {
        console.log("No activity logs found in the database at all");
      } else {
        console.log("Database has logs, but none matched the query criteria");
      }
    }
    
    // Return with the same structure as the main activity logs endpoint
    return NextResponse.json({
      logs,
      meta: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPrevPage: page > 1,
      }
    });
  } catch (error) {
    console.error("Error in debug activity logs endpoint:", error);
    return NextResponse.json(
      { error: "Failed to process debug activity logs request", details: String(error) },
      { status: 500 }
    );
  }
}`;

// Write the debug API endpoint
fs.writeFileSync(debugApiPath, debugApiContent);
console.log('Created debug activity logs API endpoint'); 
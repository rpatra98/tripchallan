const fs = require('fs');
const path = require('path');

console.log('Starting final activity logs fix...');

// 1. Update the fetchActivityLogs function in page.tsx to use debug mode
try {
  console.log('Updating activity logs page component...');
  const pageFilePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');
  const pageContent = fs.readFileSync(pageFilePath, 'utf8');
  
  // Add a note about using the debug mode API endpoint
  const updatedContent = pageContent
    .replace(
      /<Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4, alignItems: 'center' }}/,
      `<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
        {/* Debug message for SUPERADMIN */}
        {session?.user?.role === "SUPERADMIN" && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              If you don't see any activity logs, use the "Force Create Test Logs" button to create sample data.
              Then use "Debug Mode" to view all logs regardless of permissions.
            </Typography>
          </Alert>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}`
    )
    .replace(
      /<Button\s+variant="outlined"\s+color="secondary"\s+onClick={async \(\) => {[\s\S]*?Create Test Logs\s*<\/Button>/,
      `<Button
              variant="outlined"
              color="secondary"
              onClick={async () => {
                try {
                  setIsLoading(true);
                  const response = await fetch('/api/force-create-test-logs');
                  if (response.ok) {
                    const result = await response.json();
                    alert(\`Created \${result.logs?.length || 0} test logs. Refreshing...\`);
                    fetchActivityLogs(1, true); // Fetch with debug mode
                  } else {
                    const errorText = await response.text();
                    alert(\`Failed to create test logs: \${errorText}\`);
                  }
                } catch (error) {
                  console.error("Error creating test logs:", error);
                  alert(\`Error creating test logs: \${error.message}\`);
                } finally {
                  setIsLoading(false);
                }
              }}
              startIcon={<Star size={16} />}
            >
              Force Create Test Logs
            </Button>`
    );
  
  fs.writeFileSync(pageFilePath, updatedContent);
  console.log('Successfully updated activity logs page component');
} catch (err) {
  console.error('Error updating activity logs page component:', err);
}

// 2. Make sure the transformation is robust
try {
  console.log('Updating effect-transform.tsx...');
  const effectTransformPath = path.join('effect-transform.tsx');
  if (fs.existsSync(effectTransformPath)) {
    const effectTransformContent = `// Ignore this file - it's just used for copying over to the real file
// Transform logs to table data format
useEffect(() => {
  console.log("Transform effect running. Logs count:", logs?.length);
  
  if (!logs || !Array.isArray(logs) || logs.length === 0) {
    console.log("No logs to transform");
    setTableData([]);
    return;
  }
  
  try {
    // Validate logs data structure before processing
    const validLogs = logs.filter(log => {
      if (!log || typeof log !== 'object') {
        console.warn("Invalid log entry:", log);
        return false;
      }
      return true;
    });
    
    if (validLogs.length === 0) {
      console.warn("No valid logs to display");
      setTableData([]);
      return;
    }
    
    console.log("Transforming", validLogs.length, "valid logs");
    
    const formattedData = validLogs.map(log => {
      try {
        const transformed = {
          id: log.id || \`unknown-\${Math.random()}\`,
          user: {
            name: log.user?.name || "Unknown User",
            email: log.user?.email || "No email"
          },
          action: log.action || "UNKNOWN",
          details: {
            ...(log.details || {}),
            // Keep amount as is - it can be string or number
            amount: log.details?.amount !== undefined ? log.details.amount : undefined
          },
          targetUser: log.targetUser ? {
            name: log.targetUser.name || "Unknown",
            email: log.targetUser.email || "No email"
          } : undefined,
          createdAt: log.createdAt || new Date().toISOString(),
          userAgent: log.userAgent || undefined,
          targetResourceType: log.targetResourceType || "UNKNOWN"
        };
        
        console.log("Transformed log:", log.id, "->", transformed.action);
        return transformed;
      } catch (itemError) {
        console.error("Error processing log item:", itemError, log);
        return null;
      }
    }).filter(Boolean); // Remove any null entries
    
    console.log("Successfully transformed", formattedData.length, "entries");
    setTableData(formattedData);
  } catch (error) {
    console.error("Error in logs transformation:", error);
    setTableData([]);
  }
}, [logs]);`;
    
    fs.writeFileSync(effectTransformPath, effectTransformContent);
    console.log('Successfully updated effect-transform.tsx');
  } else {
    console.log('effect-transform.tsx does not exist, skipping update');
  }
} catch (err) {
  console.error('Error updating effect-transform.tsx:', err);
}

// 3. Create the special debug endpoint to bypass permissions
// This endpoint is to ensure we can always see data regardless of permissions
try {
  console.log('Creating debug API endpoint...');
  const debugApiPath = path.join('app', 'api', 'debug-activity-logs-direct', 'route.ts');
  fs.mkdirSync(path.dirname(debugApiPath), { recursive: true });
  
  const debugApiContent = `import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { UserRole } from "@/prisma/enums";
import prisma from "@/lib/prisma";

/**
 * Direct database access endpoint for activity logs debugging
 * This completely bypasses permission checks and is only for SUPERADMIN users
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user || session.user.role !== UserRole.SUPERADMIN) {
      return NextResponse.json({ error: "Unauthorized. Only SUPERADMIN can access this endpoint." }, { status: 401 });
    }
    
    console.log("Direct database query for activity logs debugging");
    
    // Get all logs directly from database with no filtering
    const logs = await prisma.activityLog.findMany({
      orderBy: {
        createdAt: "desc"
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        },
        targetUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true
          }
        }
      }
    });
    
    return NextResponse.json({
      logs,
      meta: {
        totalItems: logs.length,
        currentPage: 1,
        totalPages: 1,
        itemsPerPage: logs.length,
        hasNextPage: false,
        hasPrevPage: false
      }
    });
  } catch (error) {
    console.error("Error in direct database query:", error);
    return NextResponse.json(
      { error: "Failed to query activity logs database directly", details: String(error) },
      { status: 500 }
    );
  }
}`;
  
  fs.writeFileSync(debugApiPath, debugApiContent);
  console.log('Successfully created direct database access API endpoint');
} catch (err) {
  console.error('Error creating debug API endpoint:', err);
}

console.log('Final activity logs fix completed!'); 
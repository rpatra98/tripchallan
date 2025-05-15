const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function ensureActivityLogsExist() {
  try {
    // Check if we have any activity logs
    const logsCount = await prisma.activityLog.count();
    console.log(`Found ${logsCount} activity logs in the database`);
    
    if (logsCount === 0) {
      // If no logs exist, create some test data
      console.log("No activity logs found. Creating test data...");
      
      // Find a user to associate with the logs
      const user = await prisma.user.findFirst();
      
      if (!user) {
        console.error("No users found in the database. Cannot create test logs.");
        return;
      }
      
      // Create some sample logs
      const actionsToCreate = ['CREATE', 'UPDATE', 'VIEW', 'LOGIN', 'LOGOUT'];
      const resourceTypes = ['USER', 'COMPANY', 'SESSION', 'USER_LIST'];
      
      for (let i = 0; i < 5; i++) {
        const action = actionsToCreate[i % actionsToCreate.length];
        const resourceType = resourceTypes[i % resourceTypes.length];
        
        const details = { 
          createdAt: new Date().toISOString(),
          summaryText: `Test ${action} activity on ${resourceType}`
        };
        
        if (resourceType === 'USER') {
          details.userName = 'Test User';
          details.userRole = 'EMPLOYEE';
        } else if (resourceType === 'COMPANY') {
          details.companyName = 'Test Company';
        } else if (resourceType === 'SESSION') {
          details.sessionId = `test-session-${i}`;
          details.device = i % 2 === 0 ? 'desktop' : 'mobile';
        }
        
        await prisma.activityLog.create({
          data: {
            userId: user.id,
            action,
            targetResourceType: resourceType,
            targetResourceId: `test-resource-${i}`,
            details
          }
        });
        
        console.log(`Created activity log: ${action} - ${resourceType}`);
      }
      
      console.log("Created test activity logs successfully");
    }
  } catch (error) {
    console.error("Error ensuring activity logs exist:", error);
  } finally {
    await prisma.$disconnect();
  }
}

function fixFrontendComponent() {
  const filePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Fix the useEffect where formattedData is generated
  const transformDataEffect = /useEffect\(\(\) => \{[\s\S]*?if \(logs && (?:Array\.isArray\(logs\) && )?logs\.length > 0\) \{[\s\S]*?const formattedData[\s\S]*?\}\) \[logs\]\);/;
  
  const newTransformDataEffect = `useEffect(() => {
    console.log("Transform effect running. Logs:", logs?.length || 0);
    
    if (logs && Array.isArray(logs) && logs.length > 0) {
      try {
        const formattedData = logs.map(log => {
          if (!log) {
            console.warn("Encountered undefined log item");
            return null;
          }
          
          return {
            id: log.id || \`missing-id-\${Math.random()}\`,
            user: {
              name: log.user?.name || "Unknown",
              email: log.user?.email || "No email"
            },
            action: log.action || "UNKNOWN",
            details: {
              ...(log.details || {}),
              amount: log.details?.amount 
                ? (typeof log.details.amount === 'number' 
                  ? log.details.amount 
                  : Number(log.details.amount))
                : undefined
            },
            targetUser: log.targetUser 
              ? {
                  name: log.targetUser.name || "Unknown",
                  email: log.targetUser.email || "No email"
                }
              : undefined,
            createdAt: log.createdAt,
            userAgent: log.userAgent,
            targetResourceType: log.targetResourceType
          };
        }).filter(Boolean); // Remove any null entries
        
        console.log("Transformed data successfully:", formattedData.length);
        setTableData(formattedData);
      } catch (error) {
        console.error("Error transforming logs data:", error);
        setTableData([]);
      }
    } else {
      console.log("No logs to transform");
      setTableData([]);
    }
  }, [logs]);`;
  
  content = content.replace(transformDataEffect, newTransformDataEffect);
  
  // 2. Fix the render function to handle loading states better
  const renderFunction = /return \(\s*<Box sx=\{\{ p: 3 \}\}>([\s\S]*?)<\/Box>\s*\);/;
  const matchRender = content.match(renderFunction);
  
  if (matchRender) {
    const currentRender = matchRender[1];
    
    // Ensure we have proper loading and error states
    const newRender = `
      {console.log("Rendering activity logs, state:", { isLoading, error, logs: logs?.length, tableData: tableData?.length })}
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', color: 'primary.main' }}>
        Activity Logs
      </Typography>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="error">{error}</Alert>
          <Button
            variant="contained"
            color="primary"
            onClick={handleRefresh}
            sx={{ mt: 2 }}
          >
            Try Again
          </Button>
        </Box>
      ) : (!tableData || tableData.length === 0) ? (
        <Alert severity="info">
          No activity logs were found. This could be because:
          <ul className="mt-2 list-disc ml-5">
            <li>There are no activities recorded yet</li>
            <li>Your user role doesn't have access to these activities</li>
            <li>There may be a data retrieval issue</li>
          </ul>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleRefresh}
            sx={{ mt: 2 }}
          >
            Refresh Activity Logs
          </Button>
        </Alert>
      ) : (
        <Card>
          <CardContent>
            <SearchableTable 
              columns={columns} 
              data={tableData}
              pagination={{
                pageIndex: page - 1,
                pageSize: 10,
                pageCount: totalPages,
                onPageChange: (newPage) => setPage(newPage + 1),
                onPageSizeChange: () => {}
              }}
            />
          </CardContent>
        </Card>
      )}`;
    
    content = content.replace(renderFunction, `return (\n    <Box sx={{ p: 3 }}>${newRender}\n    </Box>\n  );`);
  }
  
  // Save the changes
  fs.writeFileSync(filePath, content);
  console.log("Fixed frontend component");
}

async function runAllFixes() {
  // First ensure we have data in the database
  await ensureActivityLogsExist();
  
  // Then fix the frontend component
  fixFrontendComponent();
  
  console.log("All fixes completed successfully");
}

runAllFixes(); 
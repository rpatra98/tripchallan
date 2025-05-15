const fs = require('fs');
const path = require('path');

const filePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Fix the logs empty check and logging
const fixFetchLogsResponse = `      
      const data: ActivityLogsResponse = await response.json();
      
      console.log("API Response:", {
        logsCount: data?.logs?.length || 0,
        totalPages: data?.meta?.totalPages || 0,
        totalItems: data?.meta?.totalItems || 0
      });
      
      if (!data.logs || !Array.isArray(data.logs)) {
        console.error("Invalid logs data received:", data.logs);
        setLogs([]);
      } else {
        setLogs(data.logs);
        console.log("Sample log:", data.logs.length > 0 ? JSON.stringify(data.logs[0]) : "No logs");
      }
      
      setTotalPages(data.meta?.totalPages || 1);
      setError("");`;

// Replace the existing response handling code
const currentFetchResponse = /const data: ActivityLogsResponse = await response\.json\(\);[\s\S]*?setTotalPages\(data\.meta\.totalPages\);[\s\S]*?setError\(""\);/;
content = content.replace(currentFetchResponse, fixFetchLogsResponse);

// Add error boundary inside the map operation to prevent crashes
const currentMapOperation = /const formattedData = logs\.map\(log => \({[\s\S]*?\}\)\);/;
const safeMapOperation = `const formattedData = logs.map(log => {
        try {
          if (!log) {
            console.error("Null or undefined log encountered");
            return null;
          }
          
          return {
            id: log.id || "unknown-id",
            user: {
              name: log.user?.name || "Unknown",
              email: log.user?.email || "No email"
            },
            action: log.action || "UNKNOWN",
            details: { 
              ...log.details, 
              // Safely convert amount to number if it's not already 
              amount: log.details?.amount 
                ? (typeof log.details.amount === 'number' ? log.details.amount : Number(log.details.amount)) 
                : undefined 
            },
            targetUser: log.targetUser ? {
              name: log.targetUser.name,
              email: log.targetUser.email
            } : undefined,
            createdAt: log.createdAt,
            userAgent: log.userAgent,
            targetResourceType: log.targetResourceType
          };
        } catch (err) {
          console.error("Error processing log:", err, log);
          return null;
        }
      }).filter(Boolean);`;

content = content.replace(currentMapOperation, safeMapOperation);

// Fix data array check
const emptyDataCheck = /if \(logs && logs\.length > 0\) \{/;
const safeEmptyDataCheck = `if (logs && Array.isArray(logs) && logs.length > 0) {`;
content = content.replace(emptyDataCheck, safeEmptyDataCheck);

// Add a more helpful error message when no logs are found
const noLogsMessage = /<Alert severity="info">No activity logs found<\/Alert>/;
const betterNoLogsMessage = `<Alert severity="info">
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
            className="mt-3"
            size="small"
          >
            Refresh Activity Logs
          </Button>
        </Alert>`;

content = content.replace(noLogsMessage, betterNoLogsMessage);

// Save the changes
fs.writeFileSync(filePath, content);

console.log('Fixed API data handling in activity logs page'); 
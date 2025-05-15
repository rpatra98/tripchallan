const fs = require('fs');
const path = require('path');

// Fix the activity logs page to properly handle data fetching and display
const pageFilePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');
let pageContent = fs.readFileSync(pageFilePath, 'utf8');

// 1. Fix the fetchActivityLogs function to handle edge cases better
pageContent = pageContent.replace(
  /const fetchActivityLogs = useCallback\(async \(pageNum: number\) => {[\s\S]*?setIsLoading\(false\);[\s\S]*?}\), \[\]\);/,
  `const fetchActivityLogs = useCallback(async (pageNum: number) => {
    try {
      console.log(\`Fetching activity logs for page \${pageNum}...\`);
      setIsLoading(true);
      setError("");
      
      const response = await fetch(\`/api/activity-logs?page=\${pageNum}\`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response:", errorText);
        throw new Error(\`Failed to fetch activity logs: \${response.status} \${errorText}\`);
      }
      
      const data = await response.json();
      console.log("Activity logs response:", data);
      
      // Validate the response structure
      if (!data || typeof data !== 'object') {
        throw new Error("Invalid response format");
      }
      
      // Handle logs being null or undefined
      if (!data.logs) {
        console.warn("No logs field in response");
        setLogs([]);
      } else if (!Array.isArray(data.logs)) {
        console.warn("Logs is not an array:", data.logs);
        setLogs([]);
      } else {
        setLogs(data.logs);
        console.log("Successfully set logs:", data.logs.length);
      }
      
      // Handle metadata
      if (data.meta && typeof data.meta.totalPages === 'number') {
        setTotalPages(data.meta.totalPages);
      } else {
        setTotalPages(1);
      }
      
      setError("");
    } catch (err) {
      console.error("Error fetching activity logs:", err);
      setError("Failed to load activity logs. Please try again later.");
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);`
);

// 2. Improve the transform effect with better error handling and debug information
pageContent = pageContent.replace(
  /useEffect\(\) => {[\s\S]*?if \(logs && logs\.length > 0\) {[\s\S]*?setTableData\(\[\]\);[\s\S]*?}\s*\}, \[logs\]\);/,
  `useEffect(() => {
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
          return {
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
  }, [logs]);`
);

// 3. Enhance the empty state UI to be more informative and include debug options
pageContent = pageContent.replace(
  /logs\.length === 0 \? \(\s*<Alert severity="info">No activity logs found<\/Alert>\s*\) : \(/,
  `logs?.length === 0 ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="info">
            <Typography variant="body1" sx={{ mb: 1 }}>No activity logs found. This could be because:</Typography>
            <ul>
              <li>There are no activities recorded yet in the system</li>
              <li>Your user role doesn't have permission to view these logs</li>
              <li>There was an error retrieving the data</li>
            </ul>
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleRefresh}
                startIcon={<RefreshCw size={16} />}
              >
                Refresh Activity Logs
              </Button>
              {session.user?.role === "SUPERADMIN" && (
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/debug-logs?createSample=true');
                      if (response.ok) {
                        const result = await response.json();
                        alert(\`Created \${result.createdSampleLogs} sample logs. Refreshing...\`);
                        handleRefresh();
                      } else {
                        alert('Failed to create sample logs');
                      }
                    } catch (error) {
                      console.error("Error creating sample logs:", error);
                      alert('Error creating sample logs');
                    }
                  }}
                >
                  Create Test Logs
                </Button>
              )}
            </Box>
          </Alert>
        </Box>
      ) : (`
);

// Save the updated file
fs.writeFileSync(pageFilePath, pageContent);
console.log('Fixed activity-logs page display issues'); 
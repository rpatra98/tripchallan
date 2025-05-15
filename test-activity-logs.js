const fs = require('fs');
const path = require('path');

const filePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Add debug logs in critical parts of the component

// 1. Add more detailed logging in the fetchActivityLogs function
const fetchLogsPattern = /const fetchActivityLogs = useCallback\(async \(pageNum: number\) => \{[\s\S]*?const data: ActivityLogsResponse = await response\.json\(\);/;
const fetchLogsDebug = `const fetchActivityLogs = useCallback(async (pageNum: number) => {
    try {
      console.log(\`Fetching activity logs for page \${pageNum}...\`);
      setIsLoading(true);
      setError("");
      
      const response = await fetch(\`/api/activity-logs?page=\${pageNum}\`);
      
      if (!response.ok) {
        throw new Error(\`Failed to fetch activity logs: \${response.status}\`);
      }
      
      const data: ActivityLogsResponse = await response.json();
      console.log("API Response:", data);
      console.log("Number of logs returned:", data?.logs?.length || 0);
      console.log("First log:", data?.logs?.[0] ? JSON.stringify(data.logs[0]) : "No logs");`;

content = content.replace(fetchLogsPattern, fetchLogsDebug);

// 2. Add detailed logging in the data transformation effect
const transformPattern = /useEffect\(\(\) => \{\s*if \(logs && logs\.length > 0\) \{/;
const transformDebug = `useEffect(() => {
    console.log("Transform logs effect running, logs length:", logs?.length || 0);
    if (logs && logs.length > 0) {
      console.log("Sample log structure:", JSON.stringify(logs[0], null, 2));`;

content = content.replace(transformPattern, transformDebug);

// 3. Add logging in the component return to debug UI rendering
const returnStartPattern = /return \(\s*<Box sx=\{\{ p: 3 \}\}>/;
const returnDebug = `return (
    <Box sx={{ p: 3 }}>
      {console.log("Rendering, tableData length:", tableData?.length || 0)}
      {console.log("isLoading:", isLoading, "error:", error, "logs length:", logs?.length || 0)}`;

content = content.replace(returnStartPattern, returnDebug);

// Add a button to force refresh data
const noLogsMessagePattern = /<Alert severity="info">No activity logs found<\/Alert>/;
const noLogsDebugButton = `<>
          <Alert severity="info">No activity logs found</Alert>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleRefresh}
            sx={{ mt: 2 }}
          >
            Refresh Activity Logs
          </Button>
          <Button 
            variant="outlined" 
            color="secondary" 
            onClick={() => console.log("Current logs:", logs, "Current tableData:", tableData)}
            sx={{ mt: 2, ml: 2 }}
          >
            Debug: Log Data
          </Button>
        </>`;

content = content.replace(noLogsMessagePattern, noLogsDebugButton);

// Save the changes
fs.writeFileSync(filePath, content);

console.log('Added debug logging to activity logs page'); 
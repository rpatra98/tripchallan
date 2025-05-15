const fs = require('fs');
const path = require('path');

// Update the activity logs page to use debug mode in API requests
console.log('Updating activity logs page to use debug mode...');

const pageFilePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');
let pageContent = fs.readFileSync(pageFilePath, 'utf8');

// Update the fetchActivityLogs function to include the debug flag
pageContent = pageContent.replace(
  /const fetchActivityLogs = useCallback\(async \(pageNum: number\) => {[\s\S]*?const response = await fetch\(`\/api\/activity-logs\?page=\${pageNum}`\);/,
  `const fetchActivityLogs = useCallback(async (pageNum: number, useDebugMode = false) => {
    try {
      console.log(\`Fetching activity logs for page \${pageNum}...\${useDebugMode ? ' (DEBUG MODE)' : ''}\`);
      setIsLoading(true);
      setError("");
      
      // Add debug flag to bypass permission filtering when needed
      const url = useDebugMode 
        ? \`/api/activity-logs?page=\${pageNum}&debug=true\`
        : \`/api/activity-logs?page=\${pageNum}\`;
      
      const response = await fetch(url);`
);

// Update the debug mode button to use the new parameter
pageContent = pageContent.replace(
  /onClick={async \(\) => {[\s\S]*?const response = await fetch\('\/api\/debug-activity-logs'\);[\s\S]*?}}/,
  `onClick={async () => {
                try {
                  setIsLoading(true);
                  // Use the regular endpoint with debug flag instead of separate debug endpoint
                  const response = await fetch('/api/activity-logs?debug=true');
                  if (!response.ok) {
                    throw new Error(\`Failed to fetch debug logs: \${response.status}\`);
                  }
                  
                  const data = await response.json();
                  console.log("Debug activity logs response:", data);
                  
                  if (!data.logs || !Array.isArray(data.logs)) {
                    alert('No logs found in debug mode');
                    setLogs([]);
                  } else {
                    setLogs(data.logs);
                    setTotalPages(data.meta?.totalPages || 1);
                    alert(\`Found \${data.logs.length} logs in debug mode\`);
                  }
                } catch (error) {
                  console.error("Error fetching debug logs:", error);
                  alert(\`Error fetching debug logs: \${error.message}\`);
                } finally {
                  setIsLoading(false);
                }
              }}`
);

// Also add console logging to help diagnose issues
pageContent = pageContent.replace(
  /useEffect\(\) => {[\s\S]*?if \(!session && !isSessionChecked\) {/,
  `useEffect(() => {
    console.log("Component mounted. Session:", session?.user ? "Available" : "Not available", 
                "Page:", page, 
                "isSessionChecked:", isSessionChecked);
                
    if (!session && !isSessionChecked) {`
);

// Save the changes
fs.writeFileSync(pageFilePath, pageContent);
console.log('Successfully updated activity logs page to use debug mode'); 
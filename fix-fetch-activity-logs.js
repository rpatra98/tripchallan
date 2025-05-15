const fs = require('fs');
const path = require('path');

// Create a better fetch function for activity logs
const filePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// Improve the fetch function
const fetchPattern = /const fetchActivityLogs = useCallback\(async \(pageNum: number\) => \{[\s\S]*?\}, \[\]\);/;
const matchFetch = content.match(fetchPattern);

if (matchFetch) {
  const improvedFetch = `const fetchActivityLogs = useCallback(async (pageNum: number) => {
    try {
      console.log(\`Fetching activity logs for page \${pageNum}...\`);
      setIsLoading(true);
      setError("");
      
      const response = await fetch(\`/api/activity-logs?page=\${pageNum}\`);
      
      if (!response.ok) {
        throw new Error(\`Failed to fetch activity logs: \${response.status}\`);
      }
      
      const data = await response.json();
      console.log("Response received:", {
        hasLogs: Boolean(data?.logs),
        logsCount: data?.logs?.length || 0,
        meta: data?.meta
      });
      
      if (!data.logs || !Array.isArray(data.logs)) {
        console.error("Invalid logs data:", data.logs);
        setLogs([]);
      } else {
        setLogs(data.logs);
        console.log("Logs set with", data.logs.length, "items");
      }
      
      setTotalPages(data.meta?.totalPages || 1);
      setError("");
    } catch (err) {
      console.error("Error fetching activity logs:", err);
      setError("Failed to load activity logs. Please try again later.");
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);`;
  
  const updatedContent = content.replace(fetchPattern, improvedFetch);
  fs.writeFileSync(filePath, updatedContent);
  console.log('Improved activity logs fetch function');
}

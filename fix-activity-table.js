const fs = require('fs');
const path = require('path');

// Fix the table component rendering
const filePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// 1. Update the return statement to improve rendering when no logs are found
const returnPattern = /return \(\s*<Box sx=\{\{ p: 3 \}\}>([\s\S]*?)<\/Box>\s*\);/;
const matchReturn = content.match(returnPattern);

if (matchReturn) {
  const improvedReturn = `return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', color: 'primary.main' }}>
        Activity Logs
      </Typography>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="error">
            {error}
            <Button
              variant="contained"
              size="small"
              onClick={handleRefresh}
              sx={{ mt: 2, ml: 2 }}
            >
              Try Again
            </Button>
          </Alert>
        </Box>
      ) : (!tableData || tableData.length === 0) ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="info">
            No activity logs were found. This could be because:
            <ul style={{ marginTop: '8px', marginLeft: '20px', listStyleType: 'disc' }}>
              <li>There are no activities recorded yet</li>
              <li>Your user role doesn't have permission to view these logs</li>
              <li>There was an error retrieving the data</li>
            </ul>
            <Button 
              variant="contained"
              size="small"
              onClick={handleRefresh}
              sx={{ mt: 2 }}
            >
              Refresh Activity Logs
            </Button>
          </Alert>
        </Box>
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
      )}
    </Box>
  );`;
  
  const updatedContent = content.replace(returnPattern, improvedReturn);
  fs.writeFileSync(filePath, updatedContent);
  console.log('Fixed activity logs page rendering');
}

// 2. Create a better fetchActivityLogs function 
const fetchFile = path.join('fix-fetch-activity-logs.js');
const fetchFix = `const fs = require('fs');
const path = require('path');

// Create a better fetch function for activity logs
const filePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// Improve the fetch function
const fetchPattern = /const fetchActivityLogs = useCallback\\(async \\(pageNum: number\\) => \\{[\\s\\S]*?\\}, \\[\\]\\);/;
const matchFetch = content.match(fetchPattern);

if (matchFetch) {
  const improvedFetch = \`const fetchActivityLogs = useCallback(async (pageNum: number) => {
    try {
      console.log(\\\`Fetching activity logs for page \\\${pageNum}...\\\`);
      setIsLoading(true);
      setError("");
      
      const response = await fetch(\\\`/api/activity-logs?page=\\\${pageNum}\\\`);
      
      if (!response.ok) {
        throw new Error(\\\`Failed to fetch activity logs: \\\${response.status}\\\`);
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
  }, []);\`;
  
  const updatedContent = content.replace(fetchPattern, improvedFetch);
  fs.writeFileSync(filePath, updatedContent);
  console.log('Improved activity logs fetch function');
}
`;

fs.writeFileSync(fetchFile, fetchFix);
console.log('Created fetch fix script'); 
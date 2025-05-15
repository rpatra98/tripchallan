const fs = require('fs');
const path = require('path');

const filePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Fix the SearchableTable component usage near the end of the file
const tableComponentRegex = /<SearchableTable[\s\S]*?\/>/;
const newTableComponent = `<SearchableTable 
              columns={columns} 
              data={tableData}
              pagination={{
                pageIndex: page - 1,
                pageSize: 10, 
                pageCount: totalPages,
                onPageChange: (newPage) => setPage(newPage + 1),
                onPageSizeChange: () => {}
              }}
            />`;

content = content.replace(tableComponentRegex, newTableComponent);

// Also fix any issues with the return statement
const returnStatementRegex = /return \(\s*<Box[\s\S]*?<\/Box>\s*\);/;
if (content.match(returnStatementRegex)) {
  const returnMatch = content.match(returnStatementRegex)[0];
  
  // Check if we have the right UI structure
  if (!returnMatch.includes('<Card>') || !returnMatch.includes('<CardContent>')) {
    // Add proper Card wrapping if missing
    const boxContentRegex = /<Box sx=\{\{ p: 3 \}\}>\s*<Typography[\s\S]*?<\/Typography>\s*([\s\S]*?)\s*<\/Box>/;
    const boxContentMatch = content.match(boxContentRegex);
    
    if (boxContentMatch) {
      const innerContent = boxContentMatch[1];
      const newBoxContent = `<Box sx={{ p: 3 }}>
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
        </Box>
      ) : logs.length === 0 ? (
        <Alert severity="info">No activity logs found</Alert>
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
    </Box>`;
      
      content = content.replace(boxContentRegex, newBoxContent);
    }
  }
}

// Save changes
fs.writeFileSync(filePath, content);

console.log('Fixed SearchableTable component in activity logs page.'); 
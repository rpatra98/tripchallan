$filePath = "app/dashboard/activity-logs/page.tsx"
$content = Get-Content -Path $filePath -Raw

# Step 1: Update the imports
Write-Host "Updating imports..."
$importPattern = '(import {[^}]+)(\} from "@/components/ui";)'
$importReplacement = '$1  SearchableTable,$2'
$content = $content -replace $importPattern, $importReplacement

# Step 2: Add the tableData state variable
Write-Host "Adding tableData state..."
$statePattern = '(\s+const \[isSessionChecked, setIsSessionChecked\] = useState\(false\);)'
$stateReplacement = '$1
  const [tableData, setTableData] = useState<ActivityLogRow[]>([]);'
$content = $content -replace $statePattern, $stateReplacement

# Step 3: Add the useEffect to transform logs to tableData
Write-Host "Adding the transformation useEffect..."
$effectPattern = '(\s+useEffect\(\(\) => {)'
$effectReplacement = '
  // Transform logs to table data format
  useEffect(() => {
    if (logs && logs.length > 0) {
      const formattedData = logs.map(log => ({
        id: log.id,
        user: {
          name: log.user?.name || "Unknown",
          email: log.user?.email || "No email"
        },
        action: log.action,
        details: log.details || {},
        targetUser: log.targetUser ? {
          name: log.targetUser.name,
          email: log.targetUser.email
        } : undefined,
        createdAt: log.createdAt,
        userAgent: log.userAgent
      }));
      
      setTableData(formattedData);
    } else {
      setTableData([]);
    }
  }, [logs]);
$1'
$content = $content -replace $effectPattern, $effectReplacement -replace "`r", ""

# Step 4: Mark the columns as searchable 
Write-Host "Marking columns as searchable..."
$columns = @("user", "action", "details", "targetUser", "createdAt")
$headers = @("User", "Action", "Details", "Target User", "Time")

for ($i = 0; $i -lt $columns.Length; $i++) {
    $columnPattern = "accessorKey: `"$($columns[$i])`",\s+header: `"$($headers[$i])`","
    $columnReplacement = "accessorKey: `"$($columns[$i])`",`n    header: `"$($headers[$i])`",`n    searchable: true,"
    $content = $content -replace $columnPattern, $columnReplacement
}

# Step 5: Replace the rendering with the SearchableTable
Write-Host "Updating the render function..."
$renderPattern = 'return \([^;]+\);'

$newRender = @'
  return (
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
    </Box>
  );
'@

$content = $content -replace $renderPattern, $newRender -replace "`r", ""

# Write the updated content back to the file
Set-Content -Path $filePath -Value $content

Write-Host "Activity logs page updated successfully!" 
#!/bin/bash

# Step 1: Update the imports
echo "Updating imports..."
sed -i '7s/}/  SearchableTable,\n}/' app/dashboard/activity-logs/page.tsx

# Step 2: Add the tableData state variable
echo "Adding tableData state..."
sed -i '/const \[isSessionChecked, setIsSessionChecked\] = useState(false);/a \ \ const [tableData, setTableData] = useState<ActivityLogRow[]>([]);' app/dashboard/activity-logs/page.tsx

# Step 3: Add the useEffect to transform logs to tableData
echo "Adding the transformation useEffect..."
sed -i '/useEffect(() => {/i \ \ // Transform logs to table data format\n\ \ useEffect(() => {\n\ \ \ \ if (logs && logs.length > 0) {\n\ \ \ \ \ \ const formattedData = logs.map(log => ({\n\ \ \ \ \ \ \ \ id: log.id,\n\ \ \ \ \ \ \ \ user: {\n\ \ \ \ \ \ \ \ \ \ name: log.user?.name || "Unknown",\n\ \ \ \ \ \ \ \ \ \ email: log.user?.email || "No email"\n\ \ \ \ \ \ \ \ },\n\ \ \ \ \ \ \ \ action: log.action,\n\ \ \ \ \ \ \ \ details: log.details || {},\n\ \ \ \ \ \ \ \ targetUser: log.targetUser ? {\n\ \ \ \ \ \ \ \ \ \ name: log.targetUser.name,\n\ \ \ \ \ \ \ \ \ \ email: log.targetUser.email\n\ \ \ \ \ \ \ \ } : undefined,\n\ \ \ \ \ \ \ \ createdAt: log.createdAt,\n\ \ \ \ \ \ \ \ userAgent: log.userAgent\n\ \ \ \ \ \ }));\n\ \ \ \ \ \ \n\ \ \ \ \ \ setTableData(formattedData);\n\ \ \ \ } else {\n\ \ \ \ \ \ setTableData([]);\n\ \ \ \ }\n\ \ }, [logs]);\n\ \ ' app/dashboard/activity-logs/page.tsx

# Step 4: Mark the columns as searchable 
echo "Marking columns as searchable..."
sed -i '/accessorKey: "user"/{n;s/header: "User",/header: "User",\n    searchable: true,/}' app/dashboard/activity-logs/page.tsx
sed -i '/accessorKey: "action"/{n;s/header: "Action",/header: "Action",\n    searchable: true,/}' app/dashboard/activity-logs/page.tsx
sed -i '/accessorKey: "details"/{n;s/header: "Details",/header: "Details",\n    searchable: true,/}' app/dashboard/activity-logs/page.tsx
sed -i '/accessorKey: "targetUser"/{n;s/header: "Target User",/header: "Target User",\n    searchable: true,/}' app/dashboard/activity-logs/page.tsx
sed -i '/accessorKey: "createdAt"/{n;s/header: "Time",/header: "Time",\n    searchable: true,/}' app/dashboard/activity-logs/page.tsx

# Step 5: Replace the rendering with the SearchableTable
echo "Updating the render function..."
cat > new_render.txt << 'EOF'
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
EOF

# Use the first few lines of the existing return statement to locate where to insert
current_return=$(grep -n 'return (' app/dashboard/activity-logs/page.tsx | head -1 | cut -d':' -f1)
if [ -n "$current_return" ]; then
  # Find the end of the return statement (assuming it ends with a closing parenthesis followed by semicolon)
  end_return=$(tail -n +$current_return app/dashboard/activity-logs/page.tsx | grep -n ');' | head -1 | cut -d':' -f1)
  
  if [ -n "$end_return" ]; then
    end_line=$((current_return + end_return - 1))
    
    # Replace the return statement
    sed -i "${current_return},${end_line}d" app/dashboard/activity-logs/page.tsx
    sed -i "${current_return}i \ \ return (" app/dashboard/activity-logs/page.tsx
    sed -i "${current_return}r new_render.txt" app/dashboard/activity-logs/page.tsx
    sed -i "${current_return}a \ \ );" app/dashboard/activity-logs/page.tsx
  fi
fi

# Clean up
rm -f new_render.txt

echo "Activity logs page updated successfully!" 
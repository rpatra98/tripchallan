$filePath = "app/dashboard/activity-logs/page.tsx"
$content = Get-Content -Path $filePath -Raw

# Complete replacement of getActionColor function
$correctActionColor = @'
const getActionColor = (action: string) => {
    switch (action) {
      case "LOGIN":
        return "success.main"; // Green for login
      case "LOGOUT":
        return "warning.main"; // Orange for logout
      case "CREATE":
        return "info.main"; // Blue for create
      case "UPDATE":
        return "primary.main"; // Default primary for update
      case "DELETE":
        return "error.main"; // Red for delete
      case "VIEW":
        return "text.secondary"; // Gray for view
      case "ALLOCATE":
        return "success.light"; // Light green for allocate
      case "TRANSFER":
        return "secondary.main"; // Purple for transfer
      default:
        return "text.secondary"; // Default gray
    }
  };
'@

# Fix for USER_LIST template string
$correctUserList = @'
            case "USER_LIST":
        return (
          <>
            <Typography variant="body2">
              Filters: {Object.entries(details.filters || {})
                .filter(([_, value]) => value !== undefined)
                .map(([key, value]) => `${key}: ${value}`)
                .join(", ")}
            </Typography>
            <Typography variant="body2">
              Results: {details.resultCount} of {details.totalCount}
            </Typography>
          </>
        );
'@

# Replace getActionColor function (need to be very specific with the pattern)
$content = $content -replace '(?s)const getActionColor = \(action: string\) => \{.*?default:\s*return <Filter.*?size=\{18\} />;\s*\};', $correctActionColor

# Replace USER_LIST case with fixed template string
$content = $content -replace '(?s)\s*case "USER_LIST":\s*return \(\s*<>\s*<Typography.*?\.map\(\[\key, value\]\) => \\: \\\).*?</Typography>\s*<Typography.*?Results:.*?</Typography>\s*</>\s*\);', $correctUserList

# Save changes
Set-Content -Path $filePath -Value $content

Write-Host "Fixed all issues in activity-logs page." 
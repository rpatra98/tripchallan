$content = Get-Content 'app/dashboard/activity-logs/page.tsx' -Raw

# Define the correct getActionColor function with only string returns
$actionColorFunc = @'
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

# Replace the function in the file
$pattern = '(?ms)const getActionColor = \(action: string\) => \{.*?default:.*?return.*?;\s*\};'
$content = $content -replace $pattern, $actionColorFunc

# Fix the template string syntax issue in USER_LIST case
$templateStringPattern = 'map\(\[\key, value\]\) => \\: \\\)'
$templateStringReplacement = 'map(([key, value]) => `${key}: ${value}`)'
$content = $content -replace $templateStringPattern, $templateStringReplacement

# Write the updated content back to the file
Set-Content 'app/dashboard/activity-logs/page.tsx' -Value $content

Write-Host "Fixed getActionColor function and template string syntax in USER_LIST case." 
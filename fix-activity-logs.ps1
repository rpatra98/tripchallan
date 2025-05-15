$filePath = "app/dashboard/activity-logs/page.tsx"
$content = Get-Content -Path $filePath -Raw

# Create a corrected getActionColor function
$newActionColor = @'
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

# Replace the broken getActionColor function
$pattern = '(?ms)  const getActionColor = \(action: string\) => \{.*?default:.*?return.*?;\s*\};'
$content = $content -replace $pattern, $newActionColor

# Fix the template string syntax error in USER_LIST case
$templatePattern = '\.map\(\[\key, value\]\) => \\: \\\)'
$templateReplacement = '.map(([key, value]) => `${key}: ${value}`)'
$content = $content -replace $templatePattern, $templateReplacement

# Write the fixed content back to the file
Set-Content -Path $filePath -Value $content

Write-Host "Fixed getActionColor function and template string syntax in activity-logs page." 
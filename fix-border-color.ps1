$correctActionColor = @"
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
        return "secondary.main"; // Secondary for view
      case "TRANSFER":
        return "purple"; // Purple for transfers
      case "ALLOCATE":
        return "success.main"; // Green for allocate
      default:
        return "text.secondary"; // Default gray
    }
  };
"@

$filePath = "app/dashboard/activity-logs/page.tsx"
$content = Get-Content -Path $filePath -Raw

# Fix getActionColor function
$pattern1 = '(?s)const getActionColor = \(action: string\) => \{.*?return "text\.secondary";.*?\};'
$content = $content -replace $pattern1, $correctActionColor

# Fix bordercolor to borderColor
$content = $content -replace 'bordercolor:', 'borderColor:'

Set-Content -Path $filePath -Value $content

Write-Host "Fixed getActionColor function and borderColor property name." 
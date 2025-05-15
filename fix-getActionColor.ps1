$filePath = "app/dashboard/activity-logs/page.tsx"
$fileContent = Get-Content -Path $filePath -Raw

# Define the correct getActionColor function with only string returns
$correctFunction = @"
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

# Find the entire function and replace it
$pattern = '(?ms)const getActionColor = \(action: string\) => \{.*?default:.*?return.*?;.*?\};'
$updatedContent = $fileContent -replace $pattern, $correctFunction

Set-Content -Path $filePath -Value $updatedContent
Write-Host "Fixed getActionColor function to only return string values" 
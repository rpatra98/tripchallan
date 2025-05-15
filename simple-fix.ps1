$file = 'app/dashboard/activity-logs/page.tsx'
$content = Get-Content $file -Raw

# Define the new getActionColor function as a string
$newFunction = @'
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

# Find and replace the function using line pattern
$startPattern = '  const getActionColor = \(action: string\) => {'
$endPattern = '  };'

# Split the content into lines
$lines = $content -split "`r`n"

# Find the start and end line numbers of the function
$startLine = 0
$endLine = 0

for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match $startPattern) {
        $startLine = $i
    }
    if ($startLine -gt 0 -and $lines[$i] -match $endPattern) {
        $endLine = $i
        break
    }
}

# If we found the function
if ($startLine -gt 0 -and $endLine -gt $startLine) {
    # Replace the function
    $newLines = @()
    $newLines += $lines[0..($startLine-1)]
    $newLines += $newFunction -split "`n"
    $newLines += $lines[($endLine+1)..($lines.Length-1)]
    
    # Write back to the file
    $newLines -join "`r`n" | Set-Content $file
    Write-Host "Successfully replaced getActionColor function."
} else {
    Write-Host "Could not find the getActionColor function in the file."
} 
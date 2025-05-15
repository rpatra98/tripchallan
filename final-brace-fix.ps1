$filePath = Join-Path $PWD "app/dashboard/activity-logs/page.tsx"
$content = Get-Content $filePath -Raw
Write-Host "Original file size: $($content.Length) bytes"

# Check if the file contains the missing brace pattern
$rowPropsPattern = "type RowProps = {
  row: {
    original: ActivityLogRow;
  };"

if ($content.Contains($rowPropsPattern)) {
    $newContent = $content.Replace($rowPropsPattern, "type RowProps = {
  row: {
    original: ActivityLogRow;
  };
};")
    
    # Write back to file
    Set-Content -Path $filePath -Value $newContent
    Write-Host "Fixed missing closing brace in RowProps type definition"
} else {
    Write-Host "Pattern not found, no changes made"
}

Write-Host "Done" 
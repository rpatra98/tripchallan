$filePath = Join-Path $PWD "app/dashboard/activity-logs/page.tsx"
$content = Get-Content $filePath -Raw
Write-Host "Original file size: $($content.Length) bytes"

# Find the position of the type RowProps declaration end
$typeRowPropsEnd = $content.IndexOf("};", $content.IndexOf("type RowProps")) + 2

# Find the position of export default function
$exportDefaultStart = $content.IndexOf("export default function")

# Extract and replace the problematic section
$newContent = $content.Substring(0, $typeRowPropsEnd) + "`n`n" + $content.Substring($exportDefaultStart)

# Write back to file
Set-Content -Path $filePath -Value $newContent
Write-Host "New file size: $($newContent.Length) bytes"
Write-Host "Successfully fixed the activity logs page" 
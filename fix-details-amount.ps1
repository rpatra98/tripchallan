$content = Get-Content -Path 'app/dashboard/activity-logs/page.tsx' -Raw

# Find and replace the problematic part
$pattern = 'details: log\.details \|\| \{\},'
$replacement = 'details: { ...log.details, amount: log.details.amount ? Number(log.details.amount) : undefined },'

# Apply the replacement
$content = $content -replace $pattern, $replacement

# Save the file
Set-Content -Path 'app/dashboard/activity-logs/page.tsx' -Value $content

Write-Host "Fixed the amount type conversion in activity logs page." 
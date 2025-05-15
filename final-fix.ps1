# Read the file content
$content = Get-Content -Path 'app/dashboard/activity-logs/page.tsx' -Raw

# Fix the USER_LIST template string syntax
$content = $content -replace '\.map\(\[\key, value\]\) => \\: \\\)', '.map(([key, value]) => `${key}: ${value}`)'

# Write the content back to the file
Set-Content -Path 'app/dashboard/activity-logs/page.tsx' -Value $content

Write-Host "Fixed template string syntax in USER_LIST case." 
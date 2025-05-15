$filePath = "app/dashboard/activity-logs/page.tsx"
$content = Get-Content -Path $filePath -Raw

# Fix the USER_LIST case template string
$userListPattern = 'Filters: \{Object\.entries\(details\.filters \|\| \{\}\)[\s\S]*?\.join\(", "\)\}'
$userListReplacement = 'Filters: {Object.entries(details.filters || {})
                .filter(([_, value]) => value !== undefined)
                .map(([key, value]) => `${key}: ${value}`)
                .join(", ")}'

$content = $content -replace $userListPattern, $userListReplacement

# Write the fixed content back to the file
Set-Content -Path $filePath -Value $content

Write-Host "Fixed template string syntax in USER_LIST case." 
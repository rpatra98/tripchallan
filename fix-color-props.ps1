$filePath = "app/dashboard/activity-logs/page.tsx"
$content = Get-Content -Path $filePath -Raw

# Fix borderColor prop in Paper component - ensure it's a string not a JSX Element
$pattern1 = 'borderColor: getActionColor\(log\.action\)'
$replacement1 = 'borderColor: getActionColor(log.action)'

# Fix color prop in Typography component - ensure it's a string not a JSX Element
$pattern2 = 'color: getActionColor\(log\.action\)'
$replacement2 = 'color: getActionColor(log.action)'

# Apply the replacements
$content = $content -replace $pattern1, $replacement1
$content = $content -replace $pattern2, $replacement2

Set-Content -Path $filePath -Value $content

Write-Host "Fixed the color props in Paper and Typography components." 
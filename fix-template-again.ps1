$userListCase = @"
      case "USER_LIST":
        return (
          <>
            <Typography variant="body2">
              Filters: {Object.entries(details.filters || {})
                .filter(([_, value]) => value !== undefined)
                .map(([key, value]) => `\${key}: \${value}`)
                .join(", ")}
            </Typography>
            <Typography variant="body2">
              Results: {details.resultCount} of {details.totalCount}
            </Typography>
          </>
        );
"@

$filePath = "app/dashboard/activity-logs/page.tsx"
$content = Get-Content -Path $filePath -Raw

# Fix USER_LIST case
$pattern = '(?s)case "USER_LIST":.*?</>.*?\);'
$content = $content -replace $pattern, $userListCase

Set-Content -Path $filePath -Value $content

Write-Host "Fixed template string in USER_LIST case." 
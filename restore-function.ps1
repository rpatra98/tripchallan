$content = @"
  const renderLogDetails = (log: ActivityLog) => {
    const details = log.details;
    
    switch (log.targetResourceType) {
      case "USER":
        // Check if this is a user creation log with our enhanced details
        if (log.action === "CREATE" && details.summaryText) {
          return (
            <>
              <Typography variant="body2" fontWeight="medium" color="primary.main">
                Created: {details.summaryText}
              </Typography>
              
              {details.userRole === "COMPANY" && details.companyName && (
                <Typography variant="body2">
                  Company: {details.companyName}
                </Typography>
              )}
              
              {details.userRole === "EMPLOYEE" && details.subrole && (
                <Typography variant="body2">
                  Role: {details.subrole}
                </Typography>
              )}
              
              {details.subrole === "OPERATOR" && details.operatorPermissions && (
                <Typography variant="body2">
                  Permissions: {Object.entries(details.operatorPermissions)
                    .filter(([_, value]) => value === true)
                    .map(([key]) => key.replace('can', ''))
                    .join(', ')}
                </Typography>
              )}
              
              <Typography variant="body2" color="text.secondary">
                Created at: {details.createdAt ? new Date(details.createdAt).toLocaleString() : "Unknown"}
              </Typography>
            </>
          );
        }
        
        // Default USER display for other types of actions
        return (
          <>
            <Typography variant="body2">
              User: {details.userEmail} ({details.userRole})
            </Typography>
            {log.targetUser && (
              <Typography variant="body2">
                Target User: {log.targetUser.name} ({log.targetUser.role})
              </Typography>
            )}
          </>
        );
        
      case "SESSION":
        return (
          <>
            <Typography variant="body2">
              Session: {details.sessionId}
            </Typography>
            <Typography variant="body2">
              From: {details.source} to {details.destination}
            </Typography>
            {details.barcode && (
              <Typography variant="body2">
                Barcode: {details.barcode}
              </Typography>
            )}
            {details.cost && (
              <Typography variant="body2">
                Cost: {details.cost}
              </Typography>
            )}
            {details.reasonText && (
              <Typography variant="body2">
                Reason: {details.reasonText}
              </Typography>
            )}
          </>
        );
        
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
        
      default:
        return (
          <Typography variant="body2">
            {JSON.stringify(details, null, 2)}
          </Typography>
        );
    }
  };
"@

$filePath = "app/dashboard/activity-logs/page.tsx"
$fileContent = Get-Content -Path $filePath -Raw
$insertPosition = $fileContent.IndexOf("  if (!session?.user) {")
$updatedContent = $fileContent.Substring(0, $insertPosition) + $content + "`r`n`r`n" + $fileContent.Substring($insertPosition)
Set-Content -Path $filePath -Value $updatedContent

Write-Host "Function restored successfully!" 
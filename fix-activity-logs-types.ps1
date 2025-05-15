$filePath = "app/dashboard/activity-logs/page.tsx"
$content = Get-Content $filePath -Raw

# 1. Fix the ActivityLogRow type by adding targetResourceType
$updatedContent = $content -replace "type ActivityLogRow = \{[^}]*userAgent\?: string;\r?\n\};", 
@"
type ActivityLogRow = {
  id: string;
  user: {
    name: string;
    email: string;
  };
  action: string;
  details: ActivityLogDetails;
  targetUser?: {
    name: string;
    email: string;
  };
  createdAt: string;
  userAgent?: string;
  targetResourceType: string;  // Added this to fix TypeScript errors
};
"@

# 2. Update the useEffect to include targetResourceType in formattedData
$updatedContent = $updatedContent -replace "const formattedData = logs\.map\(log => \(\{[^}]*userAgent: log\.userAgent\r?\n\s*\}\)\);", 
@"
const formattedData = logs.map(log => ({
  id: log.id,
  user: {
    name: log.user?.name || "Unknown",
    email: log.user?.email || "No email"
  },
  action: log.action,
  details: { 
    ...log.details, 
    // Safely convert amount to string if it's not already 
    amount: log.details.amount 
      ? (typeof log.details.amount === 'string' ? log.details.amount : String(log.details.amount)) 
      : undefined 
  },
  targetUser: log.targetUser ? {
    name: log.targetUser.name,
    email: log.targetUser.email
  } : undefined,
  createdAt: log.createdAt,
  userAgent: log.userAgent,
  targetResourceType: log.targetResourceType
}));
"@

# Save the changes
$updatedContent | Set-Content $filePath -NoNewline

Write-Host "Fixed activity logs page types and data transformation." 
const fs = require('fs');
const path = require('path');

// Fix the remaining issues in app/dashboard/activity-logs/page.tsx
const pageFilePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');
let pageContent = fs.readFileSync(pageFilePath, 'utf8');

// 1. Fix the duplicate ActivityLogRow type definition
pageContent = pageContent.replace(
  /type ActivityLogRow = {[\s\S]*?targetResourceType: string;[\s\S]*?targetResourceType\?: string;[\s\S]*?};/,
  `type ActivityLogDetails = {
  device?: string;
  reasonText?: string;
  amount?: string | number;
  recipientName?: string;
  [key: string]: unknown;
};

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
  targetResourceType: string;  // Required, not optional
};`
);

// 2. Fix the double "export default" declaration if it exists
pageContent = pageContent.replace(/export default export default function/, 'export default function');

// 3. Fix the broken user column renderer
pageContent = pageContent.replace(
  /accessorKey: "user",[\s\S]*?try {[\s\S]*?action === "LOGIN" \|\| action === "LOGOUT"/,
  `accessorKey: "user",
    header: "User",
    searchable: true,
    cell: ({ row }: RowProps) => {
      try {
        const userData = row?.original?.user;
        if (!userData) return <span>-</span>;
        
        return (
          <div className="flex flex-col">
            <span className="font-medium">{userData.name || 'Unknown'}</span>
            <span className="text-xs text-muted-foreground">{userData.email || 'No email'}</span>
          </div>
        );
      } catch (err) {
        console.error("Error rendering User column:", err);
        return <span>-</span>;
      }
    },
  },
  {
    accessorKey: "action",
    header: "Action",
    searchable: true,
    cell: ({ row }: RowProps) => {
      try {
        const action = row?.original?.action;
        const details = row?.original?.details;
        const userAgent = row?.original?.userAgent;
        
        if (!action) return <span>-</span>;
        
        return (
          <div className="flex items-center gap-2">
            {/* Highlight login/logout actions with a colored badge */}
            {action === "LOGIN" || action === "LOGOUT"`
);

// Save the fixed page file
fs.writeFileSync(pageFilePath, pageContent);
console.log('Fixed remaining issues in activity-logs/page.tsx');

console.log('All fixes completed. Verifying final state...');

// Read the updated file to verify it does not have syntax issues
try {
  const finalContent = fs.readFileSync(pageFilePath, 'utf8');
  
  // Check for duplicate return statements
  const returnCount = (finalContent.match(/return \(\n/g) || []).length;
  if (returnCount > 1) {
    console.log(`Warning: Found ${returnCount} return statements in the component, which may cause issues.`);
  } else {
    console.log('✓ Return statement count looks good.');
  }
  
  // Check for duplicate export default declarations
  const exportDefaultCount = (finalContent.match(/export default function/g) || []).length;
  if (exportDefaultCount > 1) {
    console.log(`Warning: Found ${exportDefaultCount} export default declarations, which will cause issues.`);
  } else {
    console.log('✓ Export default declaration looks good.');
  }
  
  // Check for duplicate type definitions
  const activityLogRowCount = (finalContent.match(/type ActivityLogRow =/g) || []).length;
  if (activityLogRowCount > 1) {
    console.log(`Warning: Found ${activityLogRowCount} ActivityLogRow type definitions, which may cause issues.`);
  } else {
    console.log('✓ ActivityLogRow type definition looks good.');
  }
  
  console.log('All verification checks complete.');
  
} catch (error) {
  console.error('Error reading the fixed file:', error);
} 
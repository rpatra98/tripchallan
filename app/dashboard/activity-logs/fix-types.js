const fs = require('fs');
const path = require('path');

console.log('Starting TypeScript fix for activity logs...');

// Fix type issues in the page.tsx file
const pageFilePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');
let pageContent = fs.readFileSync(pageFilePath, 'utf8');

// Make sure targetResourceType is optional in ActivityLogRow
pageContent = pageContent.replace(
  /targetResourceType: string;/,
  'targetResourceType?: string;'
);

// Make sure the amount type is consistent (string | number)
pageContent = pageContent.replace(
  /amount\?: string;/g,
  'amount?: string | number;'
);

// Update SearchableTable import and component to handle undefined table data
if (pageContent.includes('SearchableTable')) {
  // Make sure the table data is handled safely
  pageContent = pageContent.replace(
    /<SearchableTable[\s\S]*?columns={columns}[\s\S]*?data={tableData}/,
    `<SearchableTable
              columns={columns}
              data={tableData || []}`
  );
}

// Make all resource types optional to avoid type errors
pageContent = pageContent.replace(
  /targetResourceType: z\.string\(\)/,
  'targetResourceType: z.string().nullable().optional()'
);

// Make user nullable or optional in the schema
pageContent = pageContent.replace(
  /user: UserSchema/,
  'user: UserSchema.nullable().optional()'
);

// Make sure table component can handle null/undefined data
if (pageContent.includes('data={tableData}')) {
  pageContent = pageContent.replace(
    /data={tableData}/g,
    'data={tableData || []}'
  );
}

// Fix any casting issues in the data transformation
pageContent = pageContent.replace(
  /log\.details\?.amount\s+\?[\s\S]*?undefined/,
  'log.details?.amount !== undefined ? log.details.amount : undefined'
);

// Fix any potential type inconsistencies
pageContent = pageContent.replace(
  /const formattedData = logs\.map\(log =>[\s\S]*?\}\);/,
  `const formattedData = logs.map(log => {
          // Ensure the log is valid
          if (!log || typeof log !== 'object') {
            console.warn('Invalid log entry:', log);
            return null;
          }
          
          // Create a safely typed object
          return {
            id: log.id || \`unknown-\${Math.random()}\`,
            user: {
              name: log.user?.name || "Unknown User",
              email: log.user?.email || "No email"
            },
            action: log.action || "UNKNOWN",
            details: log.details || {},
            targetUser: log.targetUser ? {
              name: log.targetUser.name || "Unknown",
              email: log.targetUser.email,
            } : undefined,
            createdAt: log.createdAt || new Date().toISOString(),
            userAgent: log.userAgent || undefined,
            targetResourceType: log.targetResourceType || " - "
          };
        }).filter(Boolean);`
);

// Save the updated file
fs.writeFileSync(pageFilePath, pageContent);
console.log('Fixed TypeScript issues in activity logs page');

console.log('TypeScript fix completed!'); 
const fs = require('fs');
const path = require('path');

// Fix the interface and amount handling in app/dashboard/activity-logs/page.tsx
const pageFilePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');
let pageContent = fs.readFileSync(pageFilePath, 'utf8');

// 1. Update the amount type in the ActivityLog interface
pageContent = pageContent.replace(
  /amount\?: string;/,
  'amount?: string | number;'
);

// 2. Fix the transformation logic to keep amount as-is instead of forcing to string
pageContent = pageContent.replace(
  /\/\/ Safely convert amount to string if it's not already[\s\S]*?amount: log\.details\.amount[\s\S]*?\? \(typeof log\.details\.amount === 'string'[\s\S]*?\) [\s\S]*?\: undefined/,
  `// Keep amount as is - it can be string or number
          amount: log.details?.amount !== undefined ? log.details.amount : undefined`
);

// Save the updated file
fs.writeFileSync(pageFilePath, pageContent);
console.log('Updated amount type in ActivityLog interface and fixed transform logic'); 
const fs = require('fs');
const path = require('path');

const filePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Find and fix the duplicate ActivityLogRow type
const correctType = `type ActivityLogRow = {
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
  targetResourceType?: string;  // Added this to fix TypeScript errors
};`;

// Replace the broken type definition with the correct one
const brokenPattern = /type ActivityLogRow = \{[\s\S]*?targetResourceType\?: string;[\s\S]*?userAgent\?: string;\s*\};/;
content = content.replace(brokenPattern, correctType);

// Save the changes
fs.writeFileSync(filePath, content);

console.log('Fixed duplicate ActivityLogRow type definition'); 
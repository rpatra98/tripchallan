const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'app', 'dashboard', 'activity-logs', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. First, fix the ActivityLogDetails type to accept both string and number
const activityLogDetailsTypePattern = /type ActivityLogDetails = {[^}]*amount\?: number;[^}]*};/s;
const fixedActivityLogDetailsType = `type ActivityLogDetails = {
  device?: string;
  reasonText?: string;
  amount?: string | number;  // Accept both string and number
  recipientName?: string;
  [key: string]: unknown;
};`;

content = content.replace(activityLogDetailsTypePattern, fixedActivityLogDetailsType);

// 2. Fix the data transformation to safely convert the amount
const transformLogs = /details: { \.\.\.log\.details, amount: log\.details\.amount \? Number\(log\.details\.amount\) : undefined }/;
const safeTransform = `details: { 
          ...log.details, 
          // Safely convert amount to string if it's not already 
          amount: log.details.amount 
            ? (typeof log.details.amount === 'string' ? log.details.amount : String(log.details.amount)) 
            : undefined 
        }`;

content = content.replace(transformLogs, safeTransform);

// Save the changes
fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed ActivityLogDetails type and data transformation for amount field'); 
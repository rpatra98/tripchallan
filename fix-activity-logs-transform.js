const fs = require('fs');
const path = require('path');

const filePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Fix the data transformation in the useEffect hook
const dataTransformRegex = /useEffect\(\(\) => \{\s*if \(logs && logs\.length > 0\) \{[\s\S]*?const formattedData = logs\.map\(log => \([\s\S]*?\)\);[\s\S]*?setTableData\(formattedData\);[\s\S]*?\} else \{[\s\S]*?setTableData\(\[\]\);[\s\S]*?\}\s*\}, \[logs\]\);/;

const newDataTransform = `useEffect(() => {
    if (logs && logs.length > 0) {
      const formattedData = logs.map(log => ({
        id: log.id,
        user: {
          name: log.user?.name || "Unknown",
          email: log.user?.email || "No email"
        },
        action: log.action,
        details: { 
          ...log.details, 
          // Safely convert amount to number if it's not already 
          amount: log.details.amount 
            ? (typeof log.details.amount === 'number' ? log.details.amount : Number(log.details.amount)) 
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
      
      console.log("Transformed data:", formattedData.length, "rows");
      setTableData(formattedData);
    } else {
      setTableData([]);
    }
  }, [logs]);`;

content = content.replace(dataTransformRegex, newDataTransform);

// Save changes
fs.writeFileSync(filePath, content);

console.log('Fixed data transformation in activity logs page.'); 
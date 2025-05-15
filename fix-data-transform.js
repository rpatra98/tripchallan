const fs = require('fs');
const path = require('path');

// Fix the data transformation logic in the ActivityLogs component
const filePath = path.join('app', 'dashboard', 'activity-logs', 'page.tsx');
const content = fs.readFileSync(filePath, 'utf8');

// Fix the useEffect that transforms logs data
const transformPattern = /useEffect\(\(\) => \{[\s\S]*?if \(logs && (?:Array\.isArray\(logs\) && )?logs\.length > 0\) \{[\s\S]*?setTableData\((?:formattedData|logs\.map[\s\S]*?)\);[\s\S]*?\} else \{[\s\S]*?setTableData\(\[\]\);[\s\S]*?\}\s*\}, \[logs\]\);/;

const safeTransform = `useEffect(() => {
    console.log("Transform effect running. Logs length:", logs?.length || 0);
    
    if (logs && Array.isArray(logs) && logs.length > 0) {
      try {
        // Safely transform the logs data to prevent crashes
        const formattedData = logs.map(log => {
          try {
            if (!log) {
              console.warn("Encountered null log entry");
              return null;
            }
            
            // Create a safe version of the log entry with fallbacks for all fields
            return {
              id: log.id || \`unknown-\${Math.random()}\`,
              user: {
                name: log.user?.name || "Unknown User",
                email: log.user?.email || "No email"
              },
              action: log.action || "UNKNOWN",
              details: {
                ...(log.details || {}),
                // Safely convert amount to number
                amount: log.details?.amount
                  ? (typeof log.details.amount === 'number'
                      ? log.details.amount
                      : Number(log.details.amount))
                  : undefined
              },
              targetUser: log.targetUser
                ? {
                    name: log.targetUser.name || "Unknown",
                    email: log.targetUser.email || "No email"
                  }
                : undefined,
              createdAt: log.createdAt || new Date().toISOString(),
              userAgent: log.userAgent || undefined,
              targetResourceType: log.targetResourceType || "UNKNOWN"
            };
          } catch (itemError) {
            console.error("Error processing log item:", itemError);
            return null;
          }
        }).filter(Boolean); // Remove any null entries
        
        console.log("Successfully transformed", formattedData.length, "log entries");
        setTableData(formattedData);
      } catch (error) {
        console.error("Error in logs transformation:", error);
        setTableData([]);
      }
    } else {
      console.log("No logs to transform or logs is not an array");
      setTableData([]);
    }
  }, [logs]);`;

const updatedContent = content.replace(transformPattern, safeTransform);

// Save the file
fs.writeFileSync(filePath, updatedContent);
console.log('Fixed data transformation logic'); 
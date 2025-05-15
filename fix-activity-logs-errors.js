const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'app', 'dashboard', 'activity-logs', 'page.tsx');

// Read the original content
let content = fs.readFileSync(filePath, 'utf8');
console.log(`Original file size: ${content.length} bytes`);

// The issue is with the mixed approach: there's a columns array but it's not used
// Instead, we'll fix the syntax within the Details cell rendering 
// The specific issue is that we're mixing usage of 'details' and 'log.details'

// Find the problematic part
const badCode = `        // For login/logout events, show device info
        if (action === "LOGIN" || action === "LOGOUT") {
          const deviceType = details.device || "unknown";
          return (
            <div className="flex flex-col">
              <span className="text-sm whitespace-normal break-words max-w-sm">
                {action === "LOGIN" ? "Logged in from" : "Logged out from"} {deviceType} device
              </span>
              {details.reasonText && (
                <span className="text-xs text-muted-foreground">
                  {details.reasonText}
                </span>
              )}
            </div>
          );
        }
        
        // For transfer events, show recipient and amount
        if (action === "TRANSFER") {
          return (
            <div className="flex flex-col">
              <span className="text-sm whitespace-normal break-words max-w-sm">
                Transferred {details.amount} coins to {details.recipientName || "user"}
              </span>
              {details.reasonText && (
                <span className="text-xs text-muted-foreground">
                  Reason: {details.reasonText}
                </span>
              )}
            </div>
          );
        }
        
        // For create actions, format based on the target resource type
                            if (log.action === "CREATE") {`;

// Fix: Replace 'log.action' with 'action' and 'log.details' with 'details', and fix indentation
const fixedCode = `        // For login/logout events, show device info
        if (action === "LOGIN" || action === "LOGOUT") {
          const deviceType = details.device || "unknown";
          return (
            <div className="flex flex-col">
              <span className="text-sm whitespace-normal break-words max-w-sm">
                {action === "LOGIN" ? "Logged in from" : "Logged out from"} {deviceType} device
              </span>
              {details.reasonText && (
                <span className="text-xs text-muted-foreground">
                  {details.reasonText}
                </span>
              )}
            </div>
          );
        }
        
        // For transfer events, show recipient and amount
        if (action === "TRANSFER") {
          return (
            <div className="flex flex-col">
              <span className="text-sm whitespace-normal break-words max-w-sm">
                Transferred {details.amount} coins to {details.recipientName || "user"}
              </span>
              {details.reasonText && (
                <span className="text-xs text-muted-foreground">
                  Reason: {details.reasonText}
                </span>
              )}
            </div>
          );
        }
        
        // For create actions, format based on the target resource type
        if (action === "CREATE") {`;

if (content.includes(badCode)) {
  content = content.replace(badCode, fixedCode);
  console.log("Fixed the indentation and variable reference issues");
} else {
  console.log("Could not find the problematic code segment");
}

// Likewise, replace all instances of log.details and log.targetResourceType with details and row?.original?.targetResourceType
content = content.replace(/log\.details/g, 'details');
content = content.replace(/log\.targetResourceType/g, 'row?.original?.targetResourceType');
content = content.replace(/log\.action/g, 'action');

// Save the file
fs.writeFileSync(filePath, content, 'utf8');
console.log(`New file size: ${content.length} bytes`);
console.log('Fixed TypeScript errors in the activity logs page'); 
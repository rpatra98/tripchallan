const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'app', 'dashboard', 'activity-logs', 'page.tsx');

// Read the file content
let content = fs.readFileSync(filePath, 'utf8');
console.log(`Original file size: ${content.length} bytes`);

// Find the Details column rendering code and replace it with improved version
const detailsColumnRegex = /\/\/ For other actions with structured details, convert to readable format[\s\S]*?return <span>\{String\(log\.details\)\}<\/span>;/g;

const improvedDetailsCode = `// For create actions, format based on the target resource type
                            if (log.action === "CREATE") {
                              // Creating a user
                              if (log.targetResourceType === "USER") {
                                return (
                                  <div>
                                    <span>Created a new user account</span>
                                    {log.details.userRole && (
                                      <div className="text-xs text-muted-foreground">
                                        Role: {log.details.userRole}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              
                              // Creating a company
                              if (log.targetResourceType === "COMPANY") {
                                return (
                                  <div>
                                    <span>Created a new company: {log.details.companyName || "Unnamed"}</span>
                                  </div>
                                );
                              }
                              
                              // Creating a session
                              if (log.targetResourceType === "SESSION") {
                                return (
                                  <div>
                                    <span>Started a new session</span>
                                    {log.details.sessionId && (
                                      <div className="text-xs text-muted-foreground">
                                        Session ID: {log.details.sessionId}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                            }
                            
                            // For update actions, format based on the target resource type
                            if (log.action === "UPDATE") {
                              // Updating a user
                              if (log.targetResourceType === "USER") {
                                return (
                                  <div>
                                    <span>Updated user information</span>
                                    {log.details.userRole && (
                                      <div className="text-xs text-muted-foreground">
                                        Changed role to: {log.details.userRole}
                                      </div>
                                    )}
                                    {log.details.summaryText && (
                                      <div className="text-xs text-muted-foreground">
                                        {log.details.summaryText}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              
                              // Updating a company
                              if (log.targetResourceType === "COMPANY") {
                                return (
                                  <div>
                                    <span>Updated company information</span>
                                    {log.details.companyName && (
                                      <div className="text-xs text-muted-foreground">
                                        Company: {log.details.companyName}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                              
                              // Updating a session
                              if (log.targetResourceType === "SESSION") {
                                return (
                                  <div>
                                    <span>Updated session details</span>
                                    {log.details.sessionId && (
                                      <div className="text-xs text-muted-foreground">
                                        Session ID: {log.details.sessionId}
                                      </div>
                                    )}
                                    {log.details.summaryText && (
                                      <div className="text-xs text-muted-foreground">
                                        {log.details.summaryText}
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                            }
                            
                            // For delete actions
                            if (log.action === "DELETE") {
                              return (
                                <div>
                                  <span>Deleted a {log.targetResourceType?.toLowerCase()?.replace(/_/g, ' ') || "resource"}</span>
                                  {log.details.summaryText && (
                                    <div className="text-xs text-muted-foreground">
                                      {log.details.summaryText}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            
                            // For view actions
                            if (log.action === "VIEW") {
                              return (
                                <div>
                                  <span>Viewed {log.targetResourceType?.toLowerCase()?.replace(/_/g, ' ') || "information"}</span>
                                  {log.details.summaryText && (
                                    <div className="text-xs text-muted-foreground">
                                      {log.details.summaryText}
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            
                            // For allocate actions (typically coins or resources)
                            if (log.action === "ALLOCATE") {
                              return (
                                <div>
                                  <span>
                                    Allocated {log.details.amount || ""} {log.targetResourceType?.toLowerCase()?.replace(/_/g, ' ') || "resources"}
                                  </span>
                                  {log.details.reasonText && (
                                    <div className="text-xs text-muted-foreground">
                                      Reason: {log.details.reasonText}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            // For other actions with structured details, create a more readable format
                            if (typeof log.details === 'object') {
                              // Try to generate a meaningful summary based on available fields
                              let mainDescription = \`\${log.action.toLowerCase().replace(/_/g, ' ')} \${log.targetResourceType?.toLowerCase()?.replace(/_/g, ' ') || ""}\`.trim();
                              
                              // Extract key details to display separately
                              const importantDetails = [];
                              
                              // Check for common descriptive fields
                              if (log.details.summaryText) importantDetails.push(log.details.summaryText);
                              if (log.details.reasonText) importantDetails.push(\`Reason: \${log.details.reasonText}\`);
                              if (log.details.amount) importantDetails.push(\`Amount: \${log.details.amount}\`);
                              if (log.details.userName) importantDetails.push(\`User: \${log.details.userName}\`);
                              if (log.details.companyName) importantDetails.push(\`Company: \${log.details.companyName}\`);
                              if (log.details.sessionId) importantDetails.push(\`Session: \${log.details.sessionId}\`);
                              
                              return (
                                <div>
                                  <span className="capitalize">{mainDescription}</span>
                                  {importantDetails.length > 0 && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {importantDetails.map((detail, index) => (
                                        <div key={index}>{detail}</div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            // Default fallback for string or primitive details
                            return <span>{String(log.details || "-")}</span>;`;

// Replace the details column rendering code
if (content.match(detailsColumnRegex)) {
  content = content.replace(detailsColumnRegex, improvedDetailsCode);
  console.log("Improved the details column rendering code");
} else {
  console.log("Could not find the details column rendering code");
}

// Save the changes
fs.writeFileSync(filePath, content, 'utf8');
console.log(`New file size: ${content.length} bytes`);
console.log('Completed improvements to Activity Logs page details column'); 
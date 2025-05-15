const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'app', 'dashboard', 'activity-logs', 'page.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Log the file size to verify we have the content
console.log(`File size before modification: ${content.length} bytes`);

// 1. Replace imports by adding MUI Table components
if (content.includes('SearchableTable')) {
  // Add Material UI Table imports
  const muiTableImports = `import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton
} from "@mui/material";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";`;

  // Find the import section and add the MUI imports
  content = content.replace(
    /import \{[\s\S]*?\} from "@\/components\/ui";/,
    (match) => {
      // Remove SearchableTable from components/ui imports
      const newUIImports = match.replace(', SearchableTable', '');
      return `${newUIImports}\n${muiTableImports}`;
    }
  );
}

// 2. Replace the SearchableTable component usage with regular Table
// First find where SearchableTable is used in the render method
const tablePattern = /<SearchableTable[\s\S]*?\/>/g;
if (content.match(tablePattern)) {
  const regularTableUsage = `<TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Details</TableCell>
                    <TableCell>Target User</TableCell>
                    <TableCell>Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        No logs available
                      </TableCell>
                    </TableRow>
                  ) : (
                    tableData.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{log.user.name}</span>
                            <br />
                            <span className="text-xs text-muted-foreground">{log.user.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {log.action === "LOGIN" || log.action === "LOGOUT" ? (
                              <span className={\`px-2 py-0.5 rounded-full text-xs font-medium \${
                                log.action === "LOGIN" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"
                              }\`}>
                                {log.action.toLowerCase()}
                              </span>
                            ) : (
                              <span className="capitalize">{log.action.toLowerCase().replace(/_/g, ' ')}</span>
                            )}

                            {(log.action === "LOGIN" || log.action === "LOGOUT") && log.userAgent && (
                              <div title={\`\${log.action} from \${detectDevice(log.userAgent).type} device\`}>
                                {detectDevice(log.userAgent).isMobile ? (
                                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                                ) : (
                                  <Monitor className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            // For login/logout events, show device info
                            if (log.action === "LOGIN" || log.action === "LOGOUT") {
                              const deviceType = log.details.device || "unknown";
                              return (
                                <div>
                                  <span>
                                    {log.action === "LOGIN" ? "Logged in from" : "Logged out from"} {deviceType} device
                                  </span>
                                  {log.details.reasonText && (
                                    <div className="text-xs text-muted-foreground">
                                      {log.details.reasonText}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            // For transfer events, show recipient and amount
                            if (log.action === "TRANSFER") {
                              return (
                                <div>
                                  <span>
                                    Transferred {log.details.amount} coins to {log.details.recipientName || "user"}
                                  </span>
                                  {log.details.reasonText && (
                                    <div className="text-xs text-muted-foreground">
                                      Reason: {log.details.reasonText}
                                    </div>
                                  )}
                                </div>
                              );
                            }

                            // For other actions with structured details, convert to readable format
                            if (typeof log.details === 'object') {
                              // Convert object to readable string, excluding certain technical fields
                              const excludeKeys = ['deviceDetails', 'userAgent'];
                              const detailsText = Object.entries(log.details)
                                .filter(([key]) => !excludeKeys.includes(key))
                                .map(([key, value]) => {
                                  // Skip nested objects
                                  if (typeof value === 'object' && value !== null) {
                                    return \`\${key}: [object]\`;
                                  }
                                  return \`\${key}: \${String(value)}\`;
                                })
                                .join(', ');

                              return <span>{detailsText}</span>;
                            }

                            // Default fallback for string or primitive details
                            return <span>{String(log.details)}</span>;
                          })()}
                        </TableCell>
                        <TableCell>
                          {log.targetUser ? (
                            <div>
                              <span className="font-medium">{log.targetUser.name}</span>
                              <br />
                              <span className="text-xs text-muted-foreground">{log.targetUser.email}</span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          {formatDate(log.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={totalPages * 10} // Approximate total count based on page count
              page={page - 1}
              onPageChange={(_, newPage) => setPage(newPage + 1)}
              rowsPerPage={10}
              rowsPerPageOptions={[10]}
            />`;

  content = content.replace(tablePattern, regularTableUsage);
}

// 3. Remove the columns definition
const columnsDefinition = /\/\/ Column definition for the activity logs table\s*const columns = \[\s*\{[\s\S]*?\}\s*\];/;
if (content.match(columnsDefinition)) {
  content = content.replace(columnsDefinition, "// Table structure is defined inline in the render method");
}

// Save the changes
fs.writeFileSync(filePath, content, 'utf8');
console.log(`File size after modification: ${content.length} bytes`);
console.log('Restored Activity Logs page to use regular Material UI Table'); 
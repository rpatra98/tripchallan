const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'app', 'dashboard', 'activity-logs', 'page.tsx');

// Read the original content
const content = fs.readFileSync(filePath, 'utf8');
console.log(`Original file size: ${content.length} bytes`);

// Instead of trying to patch the existing file, let's create a new one from scratch
// that properly utilizes either the columns approach OR the direct table rendering approach

// Extract the key interfaces, types, and functions
const typeDefinitions = content.substring(
  content.indexOf('interface ActivityLog'),
  content.indexOf('// Update columns to mark them as searchable')
);

// Extract the component implementation
const componentStart = content.indexOf('export default function ActivityLogsPage');
const componentImplementation = content.substring(
  componentStart,
  content.length
);

// Create a new file with proper structure - we'll use the direct table approach
// since it has all the improved formatting for details
const newContent = `"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { UserRole, ActivityAction } from "@/prisma/enums";

import {
  Card,
  CardContent,
  Skeleton,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  DatePicker,
} from "@/components/ui";
import {
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
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import { 
  ArrowLeft, 
  Smartphone, 
  Monitor, 
  Filter, 
  RefreshCw,
  Star,
  X,
  Binoculars,
  Gift,
  ArrowLeftRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { detectDevice, formatDate } from "@/lib/utils";
import { Box, Typography, Paper, CircularProgress, Alert } from "@mui/material";

${typeDefinitions}

export default function ActivityLogsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isSessionChecked, setIsSessionChecked] = useState(false);
  const [tableData, setTableData] = useState<ActivityLogRow[]>([]);

  const fetchActivityLogs = useCallback(async (pageNum: number) => {
    try {
      console.log(\`Fetching activity logs for page \${pageNum}...\`);
      setIsLoading(true);
      setError("");
      
      const response = await fetch(\`/api/activity-logs?page=\${pageNum}\`);
      
      if (!response.ok) {
        throw new Error(\`Failed to fetch activity logs: \${response.status}\`);
      }
      
      const data: ActivityLogsResponse = await response.json();
      
      setLogs(data.logs);
      setTotalPages(data.meta.totalPages);
      setError("");
    } catch (err) {
      console.error("Error fetching activity logs:", err);
      setError("Failed to load activity logs. Please try again later.");
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Transform logs to table data format
  useEffect(() => {
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
          // Safely convert amount to string if it's not already 
          amount: log.details.amount 
            ? (typeof log.details.amount === 'string' ? log.details.amount : String(log.details.amount)) 
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
      
      setTableData(formattedData);
    } else {
      setTableData([]);
    }
  }, [logs]);

  useEffect(() => {
    if (!session && !isSessionChecked) {
      setIsSessionChecked(true);
      return;
    }
    
    if (session?.user) {
      console.log("Session is available, fetching activity logs...");
      fetchActivityLogs(page);
    }
  }, [session, page, fetchActivityLogs, isSessionChecked]);

  const handleRefresh = () => {
    fetchActivityLogs(page);
  };

  if (!session?.user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Please sign in to view activity logs</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', color: 'primary.main' }}>
        Activity Logs
      </Typography>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      ) : logs.length === 0 ? (
        <Alert severity="info">No activity logs found</Alert>
      ) : (
        <Card>
          <CardContent>
            <TableContainer>
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
                            
                            // For create actions, format based on the target resource type
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
                            return <span>{String(log.details || "-")}</span>;
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
            />
          </CardContent>
        </Card>
      )}
    </Box>
  );
}`;

// Save the file
fs.writeFileSync(filePath, newContent, 'utf8');
console.log(`New file size: ${newContent.length} bytes`);
console.log('Fixed activity logs page completely'); 
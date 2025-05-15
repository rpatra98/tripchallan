"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { UserRole, ActivityAction } from "@/prisma/enums";
import {
  DataTable,
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
  SearchableTable,
} from "@/components/ui";
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
import { z } from "zod";

interface ActivityLog {
  id: string;
  action: string;
  targetResourceType: string;
  targetResourceId: string;
  userId: string;
  createdAt: string;
  userAgent?: string;
  targetUser?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  details: {
    entityType?: string;
    userId?: string;
    userRole?: string;
    userEmail?: string;
    userName?: string;
    createdAt?: string;
    sessionId?: string;
    source?: string;
    destination?: string;
    barcode?: string;
    cost?: string;
    resourceType?: string;
    device?: string;
    reasonText?: string;
    amount?: string;
    recipientName?: string;
    filters?: {
      search?: string;
      role?: string;
      page?: number;
      limit?: number;
    };
    resultCount?: number;
    totalCount?: number;
    summaryText?: string;
    companyName?: string;
    subrole?: string;
    operatorPermissions?: Record<string, boolean>;
  };
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

interface ActivityLogsResponse {
  logs: ActivityLog[];
  meta: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  }

// Zod schemas for runtime validation
const UserSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  role: z.string().nullable().optional()
});

const ActivityLogDetailsSchema = z.record(z.unknown()).optional().nullable();

const ActivityLogSchema = z.object({
  id: z.string(),
  action: z.string(),
  targetResourceType: z.string().nullable().optional(),
  targetResourceId: z.string().nullable().optional(),
  userId: z.string(),
  createdAt: z.string().or(z.date()),
  userAgent: z.string().nullable().optional(),
  details: ActivityLogDetailsSchema,
  user: UserSchema.nullable().optional(),
  targetUser: UserSchema.nullable().optional()
});

const MetaSchema = z.object({
  currentPage: z.number().default(1),
  totalPages: z.number().default(1),
  totalItems: z.number().default(0),
  itemsPerPage: z.number().default(10),
  hasNextPage: z.boolean().default(false),
  hasPrevPage: z.boolean().default(false)
});

const ActivityLogsResponseSchema = z.object({
  logs: z.array(ActivityLogSchema).nullable().default([]),
  meta: MetaSchema.default({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10,
    hasNextPage: false,
    hasPrevPage: false
  })
});
;
}

type ActivityLogDetails = {
  device?: string;
  reasonText?: string;
  amount?: number;
  recipientName?: string;
  [key: string]: unknown;
};

type ActivityLogRow = {
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
};

type RowProps = {
  row: {
    original: ActivityLogRow;
  };
};

// Column definition for the activity logs table
const columns = [
  {
    accessorKey: "user",
    header: "User",
    searchable: true,
    cell: ({ row }: RowProps) => {
      try {
        const userData = row?.original?.user;
        if (!userData) return <span>-</span>;
        
        return (
          <div className="flex flex-col">
            <span className="font-medium">{userData.name || 'Unknown'}</span>
            <span className="text-xs text-muted-foreground">{userData.email || 'No email'}</span>
          </div>
        );
      } catch (err) {
        console.error("Error rendering User column:", err);
        return <span>-</span>;
      }
    },
  },
  {
    accessorKey: "action",
    header: "Action",
    searchable: true,
    cell: ({ row }: RowProps) => {
      try {
        const action = row?.original?.action;
        const details = row?.original?.details;
        const userAgent = row?.original?.userAgent;
        
        if (!action) return <span>-</span>;
        
        return (
          <div className="flex items-center gap-2">
            {/* Highlight login/logout actions with a colored badge */}
            {action === "LOGIN" || action === "LOGOUT" ? (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                action === "LOGIN" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"
              }`}>
                {action.toLowerCase()}
              </span>
            ) : (
              <span className="capitalize">{action.toLowerCase().replace(/_/g, ' ')}</span>
            )}
            
            {/* Display device icon for login/logout events */}
            {(action === "LOGIN" || action === "LOGOUT") && userAgent && (
              <div className="ml-2" title={`${action} from ${detectDevice(userAgent).type} device`}>
                {detectDevice(userAgent).isMobile ? (
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            )}
          </div>
        );
      } catch (err) {
        console.error("Error rendering Action column:", err);
        return <span>-</span>;
      }
    },
  },
  {
    accessorKey: "details",
    header: "Details",
    searchable: true,
    cell: ({ row }: RowProps) => {
      try {
        const details = row?.original?.details;
        const action = row?.original?.action;
        if (!details) return <span>-</span>;
        
        // For create actions, format based on the target resource type
        if (action === "CREATE") {
          // Creating a user
          if (row?.original?.targetResourceType === "USER") {
            return (
              <div>
                <span>Created a new user account</span>
                {row?.original?.details.userRole && (
                  <div className="text-xs text-muted-foreground">
                    Role: {row?.original?.details.userRole}
                  </div>
                )}
              </div>
            );
          }
          
          // Creating a company
          if (row?.original?.targetResourceType === "COMPANY") {
            return (
              <div>
                <span>Created a new company: {row?.original?.details.companyName || "Unnamed"}</span>
              </div>
            );
          }
          
          // Creating a session
          if (row?.original?.targetResourceType === "SESSION") {
            return (
              <div>
                <span>Started a new session</span>
                {row?.original?.details.sessionId && (
                  <div className="text-xs text-muted-foreground">
                    Session ID: {row?.original?.details.sessionId}
                  </div>
                )}
              </div>
            );
          }
        }
        
        // For update actions, format based on the target resource type
        if (action === "UPDATE") {
          // Updating a user
          if (row?.original?.targetResourceType === "USER") {
            return (
              <div>
                <span>Updated user information</span>
                {row?.original?.details.userRole && (
                  <div className="text-xs text-muted-foreground">
                    Changed role to: {row?.original?.details.userRole}
                  </div>
                )}
                {row?.original?.details.summaryText && (
                  <div className="text-xs text-muted-foreground">
                    {row?.original?.details.summaryText}
                  </div>
                )}
              </div>
            );
          }
          
          // Updating a company
          if (row?.original?.targetResourceType === "COMPANY") {
            return (
              <div>
                <span>Updated company information</span>
                {row?.original?.details.companyName && (
                  <div className="text-xs text-muted-foreground">
                    Company: {row?.original?.details.companyName}
                  </div>
                )}
              </div>
            );
          }
          
          // Updating a session
          if (row?.original?.targetResourceType === "SESSION") {
            return (
              <div>
                <span>Updated session details</span>
                {row?.original?.details.sessionId && (
                  <div className="text-xs text-muted-foreground">
                    Session ID: {row?.original?.details.sessionId}
                  </div>
                )}
                {row?.original?.details.summaryText && (
                  <div className="text-xs text-muted-foreground">
                    {row?.original?.details.summaryText}
                  </div>
                )}
              </div>
            );
          }
        }
        
        // For delete actions
        if (action === "DELETE") {
          return (
            <div>
              <span>Deleted a {row?.original?.targetResourceType?.toLowerCase()?.replace(/_/g, ' ') || "resource"}</span>
              {row?.original?.details.summaryText && (
                <div className="text-xs text-muted-foreground">
                  {row?.original?.details.summaryText}
                </div>
              )}
            </div>
          );
        }
        
        // For view actions
        if (action === "VIEW") {
          return (
            <div>
              <span>Viewed {row?.original?.targetResourceType?.toLowerCase()?.replace(/_/g, ' ') || "information"}</span>
              {row?.original?.details.summaryText && (
                <div className="text-xs text-muted-foreground">
                  {row?.original?.details.summaryText}
                </div>
              )}
            </div>
          );
        }
        
        // For allocate actions (typically coins or resources)
        if (action === "ALLOCATE") {
          return (
            <div>
              <span>
                Allocated {row?.original?.details.amount || ""} {row?.original?.targetResourceType?.toLowerCase()?.replace(/_/g, ' ') || "resources"}
              </span>
              {row?.original?.details.reasonText && (
                <div className="text-xs text-muted-foreground">
                  Reason: {row?.original?.details.reasonText}
                </div>
              )}
            </div>
          );
        }

        // For other actions with structured details, create a more readable format
        if (typeof details === 'object') {
          // Try to generate a meaningful summary based on available fields
          let mainDescription = `${action.toLowerCase().replace(/_/g, ' ')} ${row?.original?.targetResourceType?.toLowerCase()?.replace(/_/g, ' ') || ""}`.trim();
          
          // Extract key details to display separately
          const importantDetails = [];
          
          // Check for common descriptive fields
          if (details.summaryText) importantDetails.push(details.summaryText);
          if (details.reasonText) importantDetails.push(`Reason: ${details.reasonText}`);
          if (details.amount) importantDetails.push(`Amount: ${details.amount}`);
          if (details.userName) importantDetails.push(`User: ${details.userName}`);
          if (details.companyName) importantDetails.push(`Company: ${details.companyName}`);
          if (details.sessionId) importantDetails.push(`Session: ${details.sessionId}`);
          
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
        return <span>{String(details || "-")}</span>;
      } catch (err) {
        console.error("Error rendering Details column:", err);
        return <span>-</span>;
      }
    },
  },
  {
    accessorKey: "targetUser",
    header: "Target User",
    searchable: true,
    cell: ({ row }: RowProps) => {
      try {
        const targetUser = row?.original?.targetUser;
        if (!targetUser) return <span>-</span>;
        
        return (
          <div className="flex flex-col">
            <span className="font-medium">{targetUser.name || 'Unknown'}</span>
            <span className="text-xs text-muted-foreground">{targetUser.email || 'No email'}</span>
          </div>
        );
      } catch (err) {
        console.error("Error rendering Target User column:", err);
        return <span>-</span>;
      }
    },
  },
  {
    accessorKey: "createdAt",
    header: "Time",
    searchable: true,
    cell: ({ row }: RowProps) => {
      try {
        if (!row?.original) return <span>-</span>;
        
        const createdAt = row.original.createdAt;
        if (!createdAt) return <span>-</span>;
        
        return <span>{formatDate(createdAt)}</span>;
      } catch (err) {
        console.error("Error rendering Time column:", err);
        return <span>-</span>;
      }
    },
  },
];

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
      console.log(`Fetching activity logs for page ${pageNum}...`);
      setIsLoading(true);
      setError("");
      
      const response = await fetch(`/api/activity-logs?page=${pageNum}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch activity logs: ${response.status}`);
      }
      
      const data = await response.json();
      console.log("Response received:", {
        hasLogs: Boolean(data?.logs),
        logsCount: data?.logs?.length || 0,
        meta: data?.meta
      });
      
      if (!data.logs || !Array.isArray(data.logs)) {
        console.error("Invalid logs data:", data.logs);
        setLogs([]);
      } else {
        setLogs(data.logs);
        console.log("Logs set with", data.logs.length, "items");
      }
      
      setTotalPages(data.meta?.totalPages || 1);
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
              id: log.id || `unknown-${Math.random()}`,
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

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: true
      });
    } catch (err) {
      return dateString;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "LOGIN":
        return "success.main"; // Green for login
      case "LOGOUT":
        return "warning.main"; // Orange for logout
      case "CREATE":
        return "info.main"; // Blue for create
      case "UPDATE":
        return "primary.main"; // Default primary for update
      case "DELETE":
        return "error.main"; // Red for delete
      case "VIEW":
        return "text.secondary"; // Gray for view
      case "ALLOCATE":
        return "success.light"; // Light green for allocate
      case "TRANSFER":
        return "secondary.main"; // Purple for transfer
      default:
        return "text.secondary"; // Default gray
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "LOGIN":
        return <Smartphone className="mr-2 text-success-600" size={18} />;
      case "LOGOUT":
        return <ArrowLeft className="mr-2 text-warning-600" size={18} />;
      case "CREATE":
        return <Star className="mr-2 text-info-600" size={18} />;
      case "UPDATE":
        return <RefreshCw className="mr-2 text-primary-600" size={18} />;
      case "DELETE":
        return <X className="mr-2 text-error-600" size={18} />;
      case "VIEW":
        return <Binoculars className="mr-2 text-gray-600" size={18} />;
      case "ALLOCATE":
        return <Gift className="mr-2 text-success-500" size={18} />;
      case "TRANSFER":
        return <ArrowLeftRight className="mr-2 text-secondary-600" size={18} />;
      default:
        return <Filter className="mr-2 text-gray-600" size={18} />;
    }
  };

  const renderLogDetails = (log: ActivityLog) => {
    switch (log.targetResourceType) {
      case "USER":
        return (
          <>
            <Typography variant="body2">
              User: {log.targetUser?.name || log.details.userName || "Unknown"}
            </Typography>
            {log.details.userRole && (
              <Typography variant="body2">
                Role: {log.details.userRole}
              </Typography>
            )}
          </>
        );
      
      case "COMPANY":
        return (
          <>
            <Typography variant="body2">
              Company: {log.details.companyName || "Unknown"}
            </Typography>
            {log.details.createdAt && (
              <Typography variant="body2">
                Created: {formatDate(log.details.createdAt.toString())}
              </Typography>
            )}
          </>
        );
        
      case "SESSION":
        return (
          <>
            <Typography variant="body2">
              Session ID: {log.details.sessionId || "N/A"}
            </Typography>
            {log.details.device && (
              <Typography variant="body2">
                Device: {log.details.device}
              </Typography>
            )}
          </>
        );
        
      case "USER_LIST":
        return (
          <>
            <Typography variant="body2">
              Filters: {Object.entries(log.details.filters || {})
                .filter(([_, value]) => value !== undefined)
                .map(([key, value]) => `${key}: ${value}`)
                .join(", ")}
            </Typography>
            <Typography variant="body2">
              Results: {log.details.resultCount} of {log.details.totalCount}
            </Typography>
          </>
        );
        
      default:
        // For any other resource type, show a summary text if available
        return log.details.summaryText ? (
          <Typography variant="body2">{log.details.summaryText}</Typography>
        ) : (
          // Otherwise, just show the resource type
          <Typography variant="body2">
            Resource: {log.targetResourceType}
            {log.targetResourceId ? ` (ID: ${log.targetResourceId})` : ''}
          </Typography>
        );
    }
  };

  if (!session?.user) {
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
          <Alert severity="error">
            {error}
            <Button
              variant="contained"
              size="small"
              onClick={handleRefresh}
              sx={{ mt: 2, ml: 2 }}
            >
              Try Again
            </Button>
          </Alert>
        </Box>
      ) : (!tableData || tableData.length === 0) ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="info">
            No activity logs were found. This could be because:
            <ul style={{ marginTop: '8px', marginLeft: '20px', listStyleType: 'disc' }}>
              <li>There are no activities recorded yet</li>
              <li>Your user role doesn't have permission to view these logs</li>
              <li>There was an error retrieving the data</li>
            </ul>
            <Button 
              variant="contained"
              size="small"
              onClick={handleRefresh}
              sx={{ mt: 2 }}
            >
              Refresh Activity Logs
            </Button>
          </Alert>
        </Box>
      ) : (
        <Card>
          <CardContent>
            <SearchableTable 
              columns={columns} 
              data={tableData}
              pagination={{
                pageIndex: page - 1,
                pageSize: 10,
                pageCount: totalPages,
                onPageChange: (newPage) => setPage(newPage + 1),
                onPageSizeChange: () => {}
              }}
            />
          </CardContent>
        </Card>
      )}
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
        <>
          <Alert severity="info">
          No activity logs were found. This could be because:
          <ul className="mt-2 list-disc ml-5">
            <li>There are no activities recorded yet</li>
            <li>Your user role doesn't have access to these activities</li>
            <li>There may be a data retrieval issue</li>
          </ul>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleRefresh}
            className="mt-3"
            size="small"
          >
            Refresh Activity Logs
          </Button>
        </Alert>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleRefresh}
            sx={{ mt: 2 }}
          >
            Refresh Activity Logs
          </Button>
          <Button 
            variant="outlined" 
            color="secondary" 
            onClick={() => console.log("Current logs:", logs, "Current tableData:", tableData)}
            sx={{ mt: 2, ml: 2 }}
          >
            Debug: Log Data
          </Button>
        </>
      ) : (
        <Card>
          <CardContent>
            <SearchableTable 
              columns={columns} 
              data={tableData}
              pagination={{
                pageIndex: page - 1,
                pageSize: 10,
                pageCount: totalPages,
                onPageChange: (newPage) => setPage(newPage + 1),
                onPageSizeChange: () => {}
              }}
            />
          </CardContent>
        </Card>
      )}
    </Box>
  );
}


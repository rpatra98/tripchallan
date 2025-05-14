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
} from "@/components/ui";
import { ArrowLeft, Smartphone, Monitor, Filter, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { detectDevice, formatDate } from "@/lib/utils";
import { Box, Typography, Paper, CircularProgress, Alert } from "@mui/material";

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
  };
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
    cell: ({ row }: RowProps) => {
      try {
        const details = row?.original?.details;
        const action = row?.original?.action;
        if (!details) return <span>-</span>;
        
        // For login/logout events, show device info
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
        
        // For other actions with structured details, convert to readable format
        if (typeof details === 'object') {
          // Convert object to readable string, excluding certain technical fields
          const excludeKeys = ['deviceDetails', 'userAgent'];
          const detailsText = Object.entries(details)
            .filter(([key]) => !excludeKeys.includes(key))
            .map(([key, value]) => {
              // Skip nested objects
              if (typeof value === 'object' && value !== null) {
                return `${key}: [object]`;
              }
              return `${key}: ${String(value)}`;
            })
            .join(', ');
          
          return (
            <div className="flex flex-col">
              <span className="text-sm whitespace-normal break-words max-w-sm">
                {detailsText}
              </span>
            </div>
          );
        }
        
        // Default fallback for string or primitive details
        return (
          <div className="flex flex-col">
            <span className="text-sm whitespace-normal break-words max-w-sm">
              {String(details)}
            </span>
          </div>
        );
      } catch (err) {
        console.error("Error rendering Details column:", err);
        return <span>-</span>;
      }
    },
  },
  {
    accessorKey: "targetUser",
    header: "Target User",
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

  const fetchActivityLogs = useCallback(async (pageNum: number) => {
    try {
      console.log(`Fetching activity logs for page ${pageNum}...`);
      setIsLoading(true);
      setError("");
      
      const response = await fetch(`/api/activity-logs?page=${pageNum}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API Error Response:", response.status, errorText);
        throw new Error(`Failed to fetch activity logs: ${response.status} ${response.statusText}`);
      }
      
      const data: ActivityLogsResponse = await response.json();
      console.log("Activity logs API response:", data);
      
      // Update this section to handle the correct response structure
      if (data.logs && Array.isArray(data.logs)) {
        console.log(`Received ${data.logs.length} activity logs, first few:`, 
          data.logs.slice(0, 3).map(log => ({
            id: log.id,
            action: log.action,
            user: log.user?.name,
            userRole: log.user?.role,
            time: log.createdAt
          }))
        );
        setLogs(data.logs);
      } else {
        console.warn("No logs found in API response:", data);
        setLogs([]); // Fallback to empty array if logs field is missing
      }
      
      // Set total pages from meta data
      if (data.meta && typeof data.meta.totalPages === 'number') {
        setTotalPages(data.meta.totalPages);
      } else {
        setTotalPages(1); // Default to 1 page if pagination data is missing
      }
    } catch (err) {
      console.error("Error fetching activity logs:", err);
      setError("Failed to load activity logs. " + (err instanceof Error ? err.message : String(err)));
      // Don't set logs to empty array on error to prevent flickering
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check authentication status once
  useEffect(() => {
    if (!session) {
      // Session is still loading, do nothing yet
      return;
    }
    
    if (!session.user) {
      // User is not authenticated, redirect to login
      router.push("/auth/login");
    } else {
      // Mark session as checked to prevent repeated checks
      setIsSessionChecked(true);
    }
  }, [session, router]);

  // Only fetch logs when session is checked and user is authenticated
  useEffect(() => {
    if (isSessionChecked && session?.user) {
      console.log("Session authenticated, fetching activity logs...");
      fetchActivityLogs(page);
    }
  }, [page, session?.user, fetchActivityLogs, isSessionChecked]);
  
  // Debug: Log activity data when it changes
  useEffect(() => {
    if (logs && logs.length > 0) {
      console.log("Activity types present:", 
        [...new Set(logs.map(log => log.action))]);
    }
  }, [logs]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
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
        return "secondary.main"; // Secondary for view
      case "TRANSFER":
        return "purple"; // Purple for transfers
      default:
        return "text.secondary"; // Default gray
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case "LOGIN":
        return <Monitor className="mr-2 text-green-600" size={18} />;
      case "LOGOUT":
        return <ArrowLeft className="mr-2 text-orange-600" size={18} />;
      case "CREATE":
        return <Filter className="mr-2 text-blue-600" size={18} />;
      case "UPDATE":
        return <RefreshCw className="mr-2 text-blue-500" size={18} />;
      case "DELETE":
        return <Filter className="mr-2 text-red-600" size={18} />;
      case "TRANSFER":
        return <Filter className="mr-2 text-purple-600" size={18} />;
      default:
        return <Filter className="mr-2 text-gray-500" size={18} />;
    }
  };

  const renderLogDetails = (log: ActivityLog) => {
    const details = log.details;
    
    switch (log.targetResourceType) {
      case "USER":
        return (
          <>
            <Typography variant="body2">
              User: {details.userEmail} ({details.userRole})
            </Typography>
            {log.targetUser && (
              <Typography variant="body2">
                Target User: {log.targetUser.name} ({log.targetUser.role})
              </Typography>
            )}
          </>
        );
        
      case "SESSION":
        return (
          <>
            <Typography variant="body2">
              Session: {details.sessionId}
            </Typography>
            <Typography variant="body2">
              From: {details.source} to {details.destination}
            </Typography>
            {details.barcode && (
              <Typography variant="body2">
                Barcode: {details.barcode}
              </Typography>
            )}
            {details.cost && (
              <Typography variant="body2">
                Cost: {details.cost}
              </Typography>
            )}
            {details.reasonText && (
              <Typography variant="body2">
                Reason: {details.reasonText}
              </Typography>
            )}
          </>
        );
        
      case "USER_LIST":
        return (
          <>
            <Typography variant="body2">
              Filters: {Object.entries(details.filters || {})
                .filter(([_, value]) => value !== undefined)
                .map(([key, value]) => `${key}: ${value}`)
                .join(", ")}
            </Typography>
            <Typography variant="body2">
              Results: {details.resultCount} of {details.totalCount}
            </Typography>
          </>
        );
        
      default:
        return (
          <Typography variant="body2">
            {JSON.stringify(details, null, 2)}
          </Typography>
        );
    }
  };

  if (!session?.user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Please sign in to view activity logs</Alert>
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 4, fontWeight: 'bold', color: 'primary.main' }}>
        Activity Logs
      </Typography>

      {logs.length === 0 ? (
        <Alert severity="info">No activity logs found</Alert>
      ) : (
        <>
          {logs.map((log) => {
            const isAuthEvent = log.action === "LOGIN" || log.action === "LOGOUT";
            const deviceType = log.details?.device || "unknown";
            const deviceIcon = log.userAgent ? 
              (detectDevice(log.userAgent).isMobile ? 
                <Smartphone className="ml-2 text-gray-500" size={16} /> : 
                <Monitor className="ml-2 text-gray-500" size={16} />
              ) : null;
            
            return (
              <Paper
                key={log.id}
                sx={{
                  p: 3,
                  mb: 3,
                  borderRadius: '10px',
                  borderLeft: 6,
                  borderColor: getActionColor(log.action),
                  boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': {
                    boxShadow: '0 6px 10px rgba(0,0,0,0.1)',
                    transform: 'translateY(-2px)'
                  }
                }}
              >
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center" }}>
                    {getActionIcon(log.action)}
                    <Typography 
                      variant="subtitle1" 
                      sx={{ 
                        fontWeight: 'bold',
                        color: getActionColor(log.action),
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        fontSize: '0.9rem'
                      }}
                    >
                      {log.action}
                    </Typography>
                    
                    {isAuthEvent && deviceIcon}
                  </Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      color: "text.secondary",
                      backgroundColor: 'rgba(0,0,0,0.04)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.75rem'
                    }}
                  >
                    {formatDate(log.createdAt)}
                  </Typography>
                </Box>

                <Box sx={{ 
                  display: "flex", 
                  flexDirection: { xs: "column", sm: "row" },
                  justifyContent: "space-between",
                  mt: 2
                }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ 
                      mb: 1,
                      display: 'flex',
                      alignItems: 'center',
                      fontWeight: 'medium'
                    }}>
                      <span style={{ fontWeight: 'bold', marginRight: '4px' }}>User:</span> 
                      {log.user.name} 
                      <span style={{ 
                        backgroundColor: 'rgba(0,0,0,0.08)', 
                        padding: '2px 6px', 
                        borderRadius: '4px', 
                        fontSize: '0.7rem',
                        marginLeft: '8px'
                      }}>
                        {log.user.role}
                      </span>
                    </Typography>

                    {isAuthEvent ? (
                      <Box sx={{ 
                        p: 1.5, 
                        borderRadius: 2,
                        backgroundColor: log.action === "LOGIN" ? 'rgba(76, 175, 80, 0.08)' : 'rgba(255, 152, 0, 0.08)',
                        mt: 1
                      }}>
                        <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
                          {log.action === "LOGIN" ? "Logged in from" : "Logged out from"} <b>{deviceType}</b> device
                        </Typography>
                        {log.details?.reasonText && (
                          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                            Reason: {log.details.reasonText}
                          </Typography>
                        )}
                      </Box>
                    ) : (
                      <>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          <span style={{ fontWeight: 'bold', marginRight: '4px' }}>Resource:</span> 
                          {log.targetResourceType || "N/A"}
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          {renderLogDetails(log)}
                        </Box>
                      </>
                    )}
                  </Box>
                </Box>
              </Paper>
            );
          })}
          
          {/* Pagination Controls */}
          <Box sx={{ 
            display: "flex", 
            justifyContent: "center", 
            alignItems: "center", 
            mt: 4,
            gap: 2
          }}>
            <Button 
              variant="default"
              disabled={page <= 1} 
              onClick={() => setPage(prevPage => Math.max(1, prevPage - 1))}
            >
              Previous
            </Button>
            
            <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
              Page {page} of {totalPages}
            </Typography>
            
            <Button 
              variant="default"
              disabled={page >= totalPages} 
              onClick={() => setPage(prevPage => Math.min(totalPages, prevPage + 1))}
            >
              Next
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
} 
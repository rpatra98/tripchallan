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


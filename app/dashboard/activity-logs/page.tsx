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
  SearchableTable,} from "@/components/ui";
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
        
        // For transfer events, show recipient and amount
        if (action === "TRANSFER") {
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
        
        // Default fallback for string or primitive details
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
        details: log.details || {},
        targetUser: log.targetUser ? {
          name: log.targetUser.name,
          email: log.targetUser.email
        } : undefined,
        createdAt: log.createdAt,
        userAgent: log.userAgent
      }));
      
      setTableData(formattedData);
    } else {
      setTableData([]);
    }
  }, [logs]);

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
        details: log.details || {},
        targetUser: log.targetUser ? {
          name: log.targetUser.name,
          email: log.targetUser.email
        } : undefined,
        createdAt: log.createdAt,
        userAgent: log.userAgent
      }));
      
      setTableData(formattedData);
    } else {
      setTableData([]);
    }
  }, [logs]);

  useEffect(() => {
    if (isSessionChecked && session?.user) {
      console.log("Session authenticated, fetching activity logs...");
      fetchActivityLogs(page);
    }
  }, [page, session?.user, fetchActivityLogs, isSessionChecked]);
  
  // Debug: Log activity data when it changes
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
        details: log.details || {},
        targetUser: log.targetUser ? {
          name: log.targetUser.name,
          email: log.targetUser.email
        } : undefined,
        createdAt: log.createdAt,
        userAgent: log.userAgent
      }));
      
      setTableData(formattedData);
    } else {
      setTableData([]);
    }
  }, [logs]);

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
        return <Monitor className="mr-2 text-green-600" size={18} />;
      case "LOGOUT":
        return <ArrowLeft className="mr-2 text-orange-600" size={18} />;
      case "CREATE":
        return <Star className="mr-2 text-blue-600" size={18} />;
      case "UPDATE":
        return <RefreshCw className="mr-2 text-blue-500" size={18} />;
      case "DELETE":
        return <X className="mr-2 text-red-600" size={18} />;
      case "TRANSFER":
        return <ArrowLeftRight className="mr-2 text-purple-600" size={18} />;
      case "ALLOCATE":
        return <Gift className="mr-2 text-green-600" size={18} />;
      case "VIEW":
        return <Binoculars className="mr-2 text-gray-600" size={18} />;
      default:
        return <Filter className="mr-2 text-gray-500" size={18} />;
    }
  };

  const renderLogDetails = (log: ActivityLog) => {
    const details = log.details;
    
    switch (log.targetResourceType) {
      case "USER":
        // Check if this is a user creation log with our enhanced details
        if (log.action === "CREATE" && details.summaryText) {
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
        
        // Default USER display for other types of actions
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
        
      case "SESSION":
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
        
      case "USER_LIST":
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
        
      default:
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

  if (isLoading) {
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

  if (error) {
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



















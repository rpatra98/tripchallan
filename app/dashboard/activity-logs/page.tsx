"use client";

import { 
  ArrowLeft, 
  Smartphone, 
  Monitor, 
  Filter, 
  RefreshCw,
  Star,
  AlertTriangle,
  X,
  Binoculars,
  Gift,
  ArrowLeftRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { detectDevice, formatDate } from "@/lib/utils";
import { Box, Typography, Paper, CircularProgress, Alert , Button } from "@mui/material";
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
    amount?: string | number;
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
})

type ActivityLogDetails = {
  device?: string;
  reasonText?: string;
  amount?: string | number;
  recipientName?: string;
  userRole?: string;
  sessionId?: string;
  companyName?: string;
  summaryText?: string;
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
  targetResourceType: string;
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
    console.log("Transform effect running. Logs count:", logs?.length);
    
    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      console.log("No logs to transform");
      setTableData([]);
      return;
    }
    
    try {
      // Validate logs data structure before processing
      const validLogs = logs.filter(log => {
        if (!log || typeof log !== 'object') {
          console.warn("Invalid log entry:", log);
          return false;
        }
        return true;
      });
      
      if (validLogs.length === 0) {
        console.warn("No valid logs to display");
        setTableData([]);
        return;
      }
      
      console.log("Transforming", validLogs.length, "valid logs");
      
      const formattedData = validLogs.map(log => {
        try {
          return {
            id: log.id || `unknown-${Math.random()}`,
            user: {
              name: log.user?.name || "Unknown User",
              email: log.user?.email || "No email"
            },
            action: log.action || "UNKNOWN",
            details: {
              ...(log.details || {}),
              // Keep amount as is - it can be string or number
              amount: log.details?.amount !== undefined ? log.details.amount : undefined
            },
            targetUser: log.targetUser ? {
              name: log.targetUser.name || "Unknown",
              email: log.targetUser.email || "No email"
            } : undefined,
            createdAt: log.createdAt || new Date().toISOString(),
            userAgent: log.userAgent || undefined,
            targetResourceType: log.targetResourceType || "UNKNOWN"
          };
        } catch (itemError) {
          console.error("Error processing log item:", itemError, log);
          return null;
        }
      }).filter(Boolean); // Remove any null entries
      
      console.log("Successfully transformed", formattedData.length, "entries");
      setTableData(formattedData);
    } catch (error) {
      console.error("Error in logs transformation:", error);
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4, alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
          Activity Logs
        </Typography>
        
        {session?.user?.role === "SUPERADMIN" && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              color="secondary"
              onClick={async () => {
                try {
                  const response = await fetch('/api/debug-logs?createSample=true');
                  if (response.ok) {
                    const result = await response.json();
                    alert(`Created ${result.createdSampleLogs} sample logs. Refreshing...`);
                    handleRefresh();
                  } else {
                    alert('Failed to create sample logs');
                  }
                } catch (error) {
                  console.error("Error creating sample logs:", error);
                  alert('Error creating sample logs');
                }
              }}
              startIcon={<Star size={16} />}
            >
              Create Test Logs
            </Button>
            
            <Button
              variant="outlined"
              color="warning"
              onClick={async () => {
                try {
                  setIsLoading(true);
                  const response = await fetch('/api/debug-activity-logs');
                  if (!response.ok) {
                    throw new Error(`Failed to fetch debug logs: ${response.status}`);
                  }
                  
                  const data = await response.json();
                  console.log("Debug activity logs response:", data);
                  
                  if (!data.logs || !Array.isArray(data.logs)) {
                    alert('No logs found in debug mode');
                    setLogs([]);
                  } else {
                    setLogs(data.logs);
                    setTotalPages(data.meta?.totalPages || 1);
                    alert(`Found ${data.logs.length} logs in debug mode`);
                  }
                } catch (error) {
                  console.error("Error fetching debug logs:", error);
                  alert(`Error fetching debug logs: ${error.message}`);
                } finally {
                  setIsLoading(false);
                }
              }}
              startIcon={<AlertTriangle size={16} />}
            >
              Debug Mode
            </Button>
          </Box>
        )}
      </Box>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      ) : logs?.length === 0 ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="info">
            <Typography variant="body1" sx={{ mb: 1 }}>No activity logs found. This could be because:</Typography>
            <ul>
              <li>There are no activities recorded yet in the system</li>
              <li>Your user role doesn't have permission to view these logs</li>
              <li>There was an error retrieving the data</li>
            </ul>
            <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleRefresh}
                startIcon={<RefreshCw size={16} />}
              >
                Refresh Activity Logs
              </Button>
              {session.user?.role === "SUPERADMIN" && (
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={async () => {
                    try {
                      const response = await fetch('/api/debug-logs?createSample=true');
                      if (response.ok) {
                        const result = await response.json();
                        alert(`Created ${result.createdSampleLogs} sample logs. Refreshing...`);
                        handleRefresh();
                      } else {
                        alert('Failed to create sample logs');
                      }
                    } catch (error) {
                      console.error("Error creating sample logs:", error);
                      alert('Error creating sample logs');
                    }
                  }}
                >
                  Create Test Logs
                </Button>
              )}
            </Box>
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


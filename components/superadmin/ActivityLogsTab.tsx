"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Button, 
  CircularProgress, 
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Stack,
  IconButton,
  Chip
} from "@mui/material";
import { 
  Search, 
  RefreshCcw, 
  Filter, 
  Calendar,
  Download
} from "lucide-react";
import { formatDistance } from "date-fns";
import { supabase } from "@/lib/supabase";

interface ActivityLog {
  id: string;
  user_id: string;
  action: string;
  target_resource_type: string;
  target_resource_id: string;
  details: any;
  ip_address: string;
  user_agent: string;
  created_at: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
}

export default function ActivityLogsTab() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalLogs, setTotalLogs] = useState(0);
  const [filterAction, setFilterAction] = useState("all");
  const [filterResourceType, setFilterResourceType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actions, setActions] = useState<string[]>([]);
  const [resourceTypes, setResourceTypes] = useState<string[]>([]);

  useEffect(() => {
    fetchActivityLogs();
    fetchFilterOptions();
  }, [page, rowsPerPage, filterAction, filterResourceType]);

  const fetchActivityLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build the query
      let query = supabase
        .from('activity_logs')
        .select(`
          *,
          user:users!activity_logs_user_id_fkey(*)
        `, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(page * rowsPerPage, (page + 1) * rowsPerPage - 1);
      
      // Apply action filter
      if (filterAction !== "all") {
        query = query.eq('action', filterAction);
      }
      
      // Apply resource type filter
      if (filterResourceType !== "all") {
        query = query.eq('target_resource_type', filterResourceType);
      }
      
      // Apply search if provided
      if (searchQuery.trim()) {
        query = query.or(`user.name.ilike.%${searchQuery}%,user.email.ilike.%${searchQuery}%,details.ilike.%${searchQuery}%`);
      }
      
      const { data, error, count } = await query;
      
      if (error) {
        console.error('Error fetching activity logs:', error);
        setError(error.message);
        setLogs([]);
        setTotalLogs(0);
        setLoading(false);
        return;
      }
      
      setLogs(data || []);
      setTotalLogs(count || 0);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      setError(err instanceof Error ? err.message : 'Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchFilterOptions = async () => {
    try {
      // Fetch unique actions
      const { data: actionData, error: actionError } = await supabase
        .from('activity_logs')
        .select('action')
        .order('action');
      
      if (actionError) {
        console.error('Error fetching actions:', actionError);
        return;
      }
      
      const uniqueActions = Array.from(new Set(actionData?.map(item => item.action) || []));
      setActions(uniqueActions);
      
      // Fetch unique resource types
      const { data: resourceTypeData, error: resourceTypeError } = await supabase
        .from('activity_logs')
        .select('target_resource_type')
        .order('target_resource_type');
      
      if (resourceTypeError) {
        console.error('Error fetching resource types:', resourceTypeError);
        return;
      }
      
      const uniqueResourceTypes = Array.from(new Set(resourceTypeData?.map(item => item.target_resource_type).filter(Boolean) || []));
      setResourceTypes(uniqueResourceTypes);
    } catch (err) {
      console.error('Error fetching filter options:', err);
    }
  };

  const handleSearch = () => {
    fetchActivityLogs();
  };

  const handleClearFilters = () => {
    setFilterAction("all");
    setFilterResourceType("all");
    setSearchQuery("");
    setPage(0);
  };

  const handleRefresh = () => {
    fetchActivityLogs();
  };

  const handleExport = () => {
    // This would be implemented to export logs to CSV/Excel
    // For now, just show a toast message
    alert("Export functionality would be implemented here");
  };

  const handleChangePage = (newPage: number) => {
    setPage(newPage);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (error) {
      return dateString;
    }
  };

  const formatTimeAgo = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return formatDistance(date, new Date(), { addSuffix: true });
    } catch (error) {
      return dateString;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'success';
      case 'UPDATE':
        return 'info';
      case 'DELETE':
        return 'error';
      case 'LOGIN':
        return 'primary';
      case 'LOGOUT':
        return 'warning';
      default:
        return 'default';
    }
  };

  const formatDetails = (details: any): string => {
    if (!details) return 'No details';
    
    if (typeof details === 'string') {
      try {
        // Try to parse if it's a JSON string
        const parsed = JSON.parse(details);
        return JSON.stringify(parsed, null, 2).substring(0, 100) + (JSON.stringify(parsed).length > 100 ? '...' : '');
      } catch (e) {
        // If not valid JSON, return as is
        return details.substring(0, 100) + (details.length > 100 ? '...' : '');
      }
    }
    
    // If it's already an object
    return JSON.stringify(details, null, 2).substring(0, 100) + (JSON.stringify(details).length > 100 ? '...' : '');
  };

  if (!session?.user) {
    return <Alert severity="error">Authentication required</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 'medium' }}>
          Activity Logs
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button 
            variant="outlined" 
            startIcon={<RefreshCcw size={16} />} 
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
          
          <Button
            variant="outlined"
            startIcon={<Download size={16} />}
            onClick={handleExport}
          >
            Export
          </Button>
        </Box>
      </Box>

      {/* Search and Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={20} />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1 }}
            size="small"
          />
          
          <FormControl sx={{ minWidth: 150 }} size="small">
            <InputLabel id="action-filter-label">Action</InputLabel>
            <Select
              labelId="action-filter-label"
              id="action-filter"
              value={filterAction}
              label="Action"
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <MenuItem value="all">All Actions</MenuItem>
              {actions.map(action => (
                <MenuItem key={action} value={action}>{action}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <FormControl sx={{ minWidth: 180 }} size="small">
            <InputLabel id="resource-filter-label">Resource Type</InputLabel>
            <Select
              labelId="resource-filter-label"
              id="resource-filter"
              value={filterResourceType}
              label="Resource Type"
              onChange={(e) => setFilterResourceType(e.target.value)}
            >
              <MenuItem value="all">All Resource Types</MenuItem>
              {resourceTypes.map(type => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>
          
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleSearch}
            disabled={loading}
          >
            Search
          </Button>
          
          {(filterAction !== "all" || filterResourceType !== "all" || searchQuery.trim()) && (
            <Button 
              variant="outlined" 
              onClick={handleClearFilters}
            >
              Clear Filters
            </Button>
          )}
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={handleRefresh}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : logs.length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          No activity logs found. {(filterAction !== "all" || filterResourceType !== "all" || searchQuery.trim()) && "Try changing your filter criteria."}
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow>
                <TableCell>User</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Resource</TableCell>
                <TableCell>Details</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>IP Address</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {log.user?.name || "Unknown"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {log.user?.email || "No email"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={log.action} 
                      color={getActionColor(log.action) as "success" | "info" | "warning" | "error" | "primary" | "default"} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {log.target_resource_type || "N/A"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      ID: {log.target_resource_id ? log.target_resource_id.substring(0, 8) + '...' : "N/A"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ 
                      maxWidth: 300, 
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                      {formatDetails(log.details)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Calendar size={14} style={{ marginRight: '4px' }} />
                      <Box>
                        <Typography variant="body2">
                          {formatDate(log.created_at)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatTimeAgo(log.created_at)}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {log.ip_address || "N/A"}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {/* Pagination */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Showing {logs.length} of {totalLogs} logs
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Button 
                disabled={page === 0} 
                onClick={() => handleChangePage(page - 1)}
              >
                Previous
              </Button>
              <Typography sx={{ mx: 2 }}>
                Page {page + 1} of {Math.ceil(totalLogs / rowsPerPage)}
              </Typography>
              <Button 
                disabled={(page + 1) * rowsPerPage >= totalLogs} 
                onClick={() => handleChangePage(page + 1)}
              >
                Next
              </Button>
            </Box>
          </Box>
        </TableContainer>
      )}
    </Box>
  );
} 
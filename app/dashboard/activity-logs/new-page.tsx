"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { 
  ArrowLeft, 
  Smartphone, 
  Monitor, 
  Filter, 
  RefreshCw,
  Star,
  AlertTriangle,
  Download,
  Calendar,
  Search
} from 'lucide-react';
import { 
  Box, 
  Typography, 
  Paper, 
  CircularProgress, 
  Alert, 
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Drawer,
  IconButton,
  Chip,
  Divider,
  Stack,
  Grid
} from '@mui/material';
import { formatDate, detectDevice } from '@/lib/utils';import { format } from 'date-fns';// DatePicker components removed to fix deployment issues

// Simple TypeScript interfaces
interface User {
  id?: string;
  name?: string;
  email?: string;
  role?: string;
}

interface ActivityDetails {
  [key: string]: any;
}

interface ActivityLog {
  id: string;
  action: string;
  targetResourceType?: string;
  targetResourceId?: string;
  userId: string;
  createdAt: string;
  userAgent?: string;
  targetUser?: User;
  user?: User;
  details?: ActivityDetails;
}

interface ActivityLogRow {
  id: string;
  user: {
    name: string;
    email: string;
  };
  action: string;
  details: ActivityDetails;
  targetUser?: {
    name: string;
    email: string;
  };
  createdAt: string;
  userAgent?: string;
  targetResourceType?: string;
}

interface FilterOptions {
  action: string;
  startDate: Date | null;
  endDate: Date | null;
  user: string;
  resourceType: string;
}

// Main component
export default function ActivityLogsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [tableData, setTableData] = useState<ActivityLogRow[]>([]);
  const [filteredData, setFilteredData] = useState<ActivityLogRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<{name: string, email: string}[]>([]);
  const [availableResourceTypes, setAvailableResourceTypes] = useState<string[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({
    action: '',
    startDate: null,
    endDate: null,
    user: '',
    resourceType: ''
  });
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  // Handle date input changes
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value ? new Date(e.target.value) : null;
    setFilters({...filters, startDate: dateValue});
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value ? new Date(e.target.value) : null;
    setFilters({...filters, endDate: dateValue});
  };

  // Fetch activity logs with robust error handling
  const fetchActivityLogs = useCallback(async (pageNum: number, useDebugMode = false) => {
    try {
      console.log(`Fetching activity logs for page ${pageNum}...`);
      setIsLoading(true);
      setError('');
      
      // Use debug mode by default to ensure we get data
      const url = useDebugMode 
        ? `/api/activity-logs?page=${pageNum}&debug=true` 
        : `/api/activity-logs?page=${pageNum}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('API Response:', data);
      
      if (!data || !data.logs || !Array.isArray(data.logs)) {
        console.warn('Invalid API response format:', data);
        setLogs([]);
        setTotalPages(1);
      } else {
        setLogs(data.logs);
        setTotalPages(data.meta?.totalPages || 1);
      }
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      setError(`Failed to load activity logs: ${err instanceof Error ? err.message : String(err)}`);
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchActivityLogs(page);
  }, [fetchActivityLogs, page]);

  // Try fallback if normal data fetch fails
  const fetchGuaranteedData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');
      
      const response = await fetch('/api/guaranteed-logs');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch guaranteed logs: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Guaranteed logs response:', data);
      
      if (!data.logs || !Array.isArray(data.logs)) {
        alert('Error: No logs in response');
        setLogs([]);
      } else {
        setLogs(data.logs);
        setTotalPages(data.meta?.totalPages || 1);
        alert(`Found ${data.logs.length} guaranteed logs`);
      }
    } catch (error) {
      console.error('Error fetching guaranteed logs:', error);
      alert(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create test log data
  const createTestLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/force-create-test-logs');
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create test logs: ${errorText}`);
      }
      
      const result = await response.json();
      alert(`Created ${result.logs?.length || 0} test logs. Refreshing...`);
      fetchActivityLogs(1, true);
    } catch (error: any) {
      console.error('Error creating test logs:', error);
      alert(`Error creating test logs: ${error.message || String(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [fetchActivityLogs]);

  // Transform API data to table format safely
  useEffect(() => {
    console.log('Transform effect running. Logs count:', logs?.length);
    
    if (!logs || !Array.isArray(logs) || logs.length === 0) {
      console.log('No logs to transform');
      setTableData([]);
      return;
    }
    
    try {
      const formattedData = logs.map(log => {
        try {
          return {
            id: log.id || `unknown-${Math.random()}`,
            user: {
              name: log.user?.name || 'Unknown User',
              email: log.user?.email || 'No email'
            },
            action: log.action || 'UNKNOWN',
            details: log.details || {},
            targetUser: log.targetUser ? {
              name: log.targetUser.name || 'Unknown',
              email: log.targetUser.email || 'No email'
            } : undefined,
            createdAt: log.createdAt || new Date().toISOString(),
            userAgent: log.userAgent || undefined,
            targetResourceType: log.targetResourceType || ' - '
          };
        } catch (err) {
          console.error('Error processing log item:', err, log);
          return null;
        }
      }).filter(Boolean) as ActivityLogRow[];
      
      console.log('Transformed data:', formattedData.length, 'items');
      setTableData(formattedData);
      setFilteredData(formattedData);
      
      // Extract available filter options
      const actions = Array.from(new Set(formattedData.map(item => item.action)));
      const users = formattedData.reduce((acc, item) => {
        const userKey = `${item.user.email}`;
        if (!acc.some(u => u.email === item.user.email)) {
          acc.push(item.user);
        }
        return acc;
      }, [] as {name: string, email: string}[]);
      const resourceTypes = Array.from(new Set(formattedData
        .map(item => item.targetResourceType)
        .filter(Boolean) as string[]
      ));
      
      setAvailableActions(actions);
      setAvailableUsers(users);
      setAvailableResourceTypes(resourceTypes);
    } catch (error) {
      console.error('Error transforming logs:', error);
      setTableData([]);
      setFilteredData([]);
    }
  }, [logs]);

  // Apply filters effect
  useEffect(() => {
    if (tableData.length === 0) return;
    
    let filtered = [...tableData];
    const activeFiltersList: string[] = [];
    
    // Filter by action
    if (filters.action) {
      filtered = filtered.filter(row => row.action === filters.action);
      activeFiltersList.push(`Action: ${formatAction(filters.action)}`);
    }
    
    // Filter by date range
    if (filters.startDate) {
      const startTimestamp = filters.startDate.getTime();
      filtered = filtered.filter(row => {
        const rowDate = new Date(row.createdAt).getTime();
        return rowDate >= startTimestamp;
      });
      activeFiltersList.push(`After: ${format(filters.startDate, 'MMM dd, yyyy')}`);
    }
    
    if (filters.endDate) {
      const endTimestamp = filters.endDate.getTime();
      filtered = filtered.filter(row => {
        const rowDate = new Date(row.createdAt).getTime();
        return rowDate <= endTimestamp;
      });
      activeFiltersList.push(`Before: ${format(filters.endDate, 'MMM dd, yyyy')}`);
    }
    
    // Filter by user
    if (filters.user) {
      filtered = filtered.filter(row => row.user.email === filters.user);
      const userName = availableUsers.find(u => u.email === filters.user)?.name || filters.user;
      activeFiltersList.push(`User: ${userName}`);
    }
    
    // Filter by resource type
    if (filters.resourceType) {
      filtered = filtered.filter(row => row.targetResourceType === filters.resourceType);
      activeFiltersList.push(`Resource: ${filters.resourceType}`);
    }
    
    setFilteredData(filtered);
    setActiveFilters(activeFiltersList);
  }, [filters, tableData, availableUsers]);

  // Initial data loading
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      console.log('Session authenticated, fetching activity logs...');
      fetchActivityLogs(page);
    } else if (status === 'unauthenticated') {
      console.log('User not authenticated');
      setError('Please sign in to view activity logs');
    }
  }, [status, session, page, fetchActivityLogs]);

  // Handle page change
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage + 1);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(1);
  };

  // Render device icon
  const renderDeviceIcon = (details?: ActivityDetails, userAgent?: string) => {
    const device = details?.device || detectDevice(userAgent || '');
    if (device === 'mobile') {
      return <Smartphone size={16} />;
    }
    return <Monitor size={16} />;
  };

  // Format action for display
  const formatAction = (action: string) => {
    return action.charAt(0) + action.slice(1).toLowerCase().replace(/_/g, ' ');
  };

  // Export to CSV
  const exportToCSV = () => {
    if (filteredData.length === 0) {
      alert('No data to export');
      return;
    }
    
    // Prepare CSV content
    const headers = ['User', 'Email', 'Action', 'Target', 'Target Email', 'Date', 'Device'];
    const rows = filteredData.map(row => [
      row.user.name,
      row.user.email,
      formatAction(row.action),
      row.targetUser?.name || row.targetResourceType || 'Unknown',
      row.targetUser?.email || '',
      formatDate(row.createdAt),
      detectDevice(row.userAgent || '')
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Set filename with date
    const today = new Date();
    const filename = `activity_logs_${format(today, 'yyyy-MM-dd')}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Reset all filters
  const resetFilters = () => {
    setFilters({
      action: '',
      startDate: null,
      endDate: null,
      user: '',
      resourceType: ''
    });
    setFilterDrawerOpen(false);
  };

  // If user not authenticated
  if (status === 'unauthenticated') {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Please sign in to view activity logs</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
        {/* Debug message for SUPERADMIN */}
        {session?.user?.role === "SUPERADMIN" && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2">
              If you don't see any activity logs, use the "Create Test Logs" button to create sample data.
              Then use "Show Guaranteed Data" to view logs regardless of permissions.
            </Typography>
          </Alert>
        )}
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
            Activity Logs
          </Typography>
          
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<Filter size={16} />}
              onClick={() => setFilterDrawerOpen(true)}
            >
              Filter
            </Button>
            
            <Button
              variant="outlined"
              startIcon={<Download size={16} />}
              onClick={exportToCSV}
              disabled={filteredData.length === 0}
            >
              Export CSV
            </Button>
            
            {session?.user?.role === "SUPERADMIN" && (
              <>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={createTestLogs}
                  startIcon={<Star size={16} />}
                >
                  Create Test Logs
                </Button>
                
                <Button
                  variant="outlined"
                  color="warning"
                  onClick={fetchGuaranteedData}
                  startIcon={<AlertTriangle size={16} />}
                >
                  Show Guaranteed Data
                </Button>
              </>
            )}
          </Box>
        </Box>
        
        {/* Active filters display */}
        {activeFilters.length > 0 && (
          <Box sx={{ mt: 1, mb: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>Active filters:</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {activeFilters.map((filter, index) => (
                <Chip 
                  key={index} 
                  label={filter} 
                  size="small"
                  color="primary"
                  variant="outlined"
                />
              ))}
              <Chip 
                label="Reset All" 
                size="small"
                color="secondary"
                onClick={resetFilters}
              />
            </Stack>
          </Box>
        )}
        
        {/* Filter Drawer */}
        <Drawer
          anchor="right"
          open={filterDrawerOpen}
          onClose={() => setFilterDrawerOpen(false)}
        >
          <Box sx={{ width: 300, p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Filter Logs</Typography>
              <IconButton onClick={() => setFilterDrawerOpen(false)}>
                <ArrowLeft size={20} />
              </IconButton>
            </Box>
            
            <Divider sx={{ mb: 3 }} />
            
            <Stack spacing={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Action</InputLabel>
                <Select
                  value={filters.action}
                  label="Action"
                  onChange={(e) => setFilters({...filters, action: e.target.value as string})}
                >
                  <MenuItem value="">All Actions</MenuItem>
                  {availableActions.map(action => (
                    <MenuItem key={action} value={action}>{formatAction(action)}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <TextField
                label="Start Date"
                type="date"
                value={filters.startDate ? format(filters.startDate, 'yyyy-MM-dd') : ''}
                onChange={handleStartDateChange}
                fullWidth
                size="small"
                InputLabelProps={{
                  shrink: true,
                }}
              />
              
              <TextField
                label="End Date"
                type="date"
                value={filters.endDate ? format(filters.endDate, 'yyyy-MM-dd') : ''}
                onChange={handleEndDateChange}
                fullWidth
                size="small"
                InputLabelProps={{
                  shrink: true,
                }}
              />
              
              <FormControl fullWidth size="small">
                <InputLabel>User</InputLabel>
                <Select
                  value={filters.user}
                  label="User"
                  onChange={(e) => setFilters({...filters, user: e.target.value as string})}
                >
                  <MenuItem value="">All Users</MenuItem>
                  {availableUsers.map(user => (
                    <MenuItem key={user.email} value={user.email}>
                      {user.name} ({user.email})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <FormControl fullWidth size="small">
                <InputLabel>Resource Type</InputLabel>
                <Select
                  value={filters.resourceType}
                  label="Resource Type"
                  onChange={(e) => setFilters({...filters, resourceType: e.target.value as string})}
                >
                  <MenuItem value="">All Resources</MenuItem>
                  {availableResourceTypes.map(type => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              
              <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                <Button 
                  variant="contained" 
                  fullWidth
                  onClick={() => setFilterDrawerOpen(false)}
                >
                  Apply Filters
                </Button>
                <Button 
                  variant="outlined" 
                  fullWidth
                  onClick={resetFilters}
                >
                  Reset
                </Button>
              </Box>
            </Stack>
          </Box>
        </Drawer>
        
        {/* Debug info panel */}
        <Box sx={{ p: 2, bgcolor: 'rgba(0,0,0,0.03)', borderRadius: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>DEBUG INFO:</Typography>
          <Typography variant="body2">Status: {status}</Typography>
          <Typography variant="body2">Logs: {logs?.length || 0} items</Typography>
          <Typography variant="body2">Table data: {tableData?.length || 0} items</Typography>
          <Typography variant="body2">Filtered data: {filteredData?.length || 0} items</Typography>
          <Typography variant="body2">Loading: {isLoading ? 'Yes' : 'No'}</Typography>
          <Typography variant="body2">Error: {error || 'None'}</Typography>
          <Button
            variant="outlined"
            size="small"
            sx={{ mt: 1 }}
            onClick={() => {
              console.log('Logs:', logs);
              console.log('Table data:', tableData);
              console.log('Filtered data:', filteredData);
              alert('Check the console for full data dump');
            }}
          >
            Log Data to Console
          </Button>
        </Box>
      </Box>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="error">{error}</Alert>
          <Button
            variant="contained"
            color="primary"
            onClick={handleRefresh}
            sx={{ mt: 2 }}
          >
            Try Again
          </Button>
        </Box>
      ) : filteredData.length === 0 ? (
        <Box sx={{ p: 3 }}>
          <Alert severity="info">
            <Typography variant="body1" sx={{ mb: 1 }}>No activity logs found. This could be because:</Typography>
            <ul>
              <li>There are no activities recorded yet in the system</li>
              <li>Your user role doesn't have permission to view these logs</li>
              <li>There was an error retrieving the data</li>
              <li>The current filters are excluding all available data</li>
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
              {activeFilters.length > 0 && (
                <Button
                  variant="outlined"
                  onClick={resetFilters}
                >
                  Clear Filters
                </Button>
              )}
              {session?.user?.role === "SUPERADMIN" && (
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={createTestLogs}
                  startIcon={<Star size={16} />}
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
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Target</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredData.slice((page-1)*rowsPerPage, page*rowsPerPage).map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 500 }}>{row.user.name}</span>
                          <span style={{ fontSize: '0.75rem', color: '#666' }}>{row.user.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {renderDeviceIcon(row.details, row.userAgent)}
                          <span>{formatAction(row.action)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {row.targetUser ? (
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span>{row.targetUser.name}</span>
                            <span style={{ fontSize: '0.75rem', color: '#666' }}>{row.targetUser.email}</span>
                          </div>
                        ) : (
                          <span>{row.targetResourceType || ' - '}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {formatDate(row.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component="div"
              count={filteredData.length}
              page={page - 1}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25]}
            />
          </CardContent>
        </Card>
      )}
    </Box>
  );
} 
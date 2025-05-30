"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  CircularProgress, 
  Alert, 
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid as MuiGrid
} from "@mui/material";
import { 
  Users, 
  Building, 
  Car, 
  Database, 
  Coins, 
  BarChart,
  RefreshCcw
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface SystemStats {
  totalUsers: number;
  totalAdmins: number;
  totalCompanies: number;
  totalEmployees: number;
  totalSessions: number;
  totalCoins: number;
  activeSessions: number;
  completedSessions: number;
  pendingSessions: number;
}

export default function SystemStats() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    totalAdmins: 0,
    totalCompanies: 0,
    totalEmployees: 0,
    totalSessions: 0,
    totalCoins: 0,
    activeSessions: 0,
    completedSessions: 0,
    pendingSessions: 0
  });
  const [timePeriod, setTimePeriod] = useState('all');
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  useEffect(() => {
    fetchSystemStats();
    fetchRecentActivities();
  }, [timePeriod]);

  const fetchSystemStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user counts
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('role', { count: 'exact' });
      
      if (userError) throw new Error(userError.message);
      
      const totalUsers = userData?.length || 0;
      const totalAdmins = userData?.filter(u => u.role === 'ADMIN').length || 0;
      const totalCompanies = await fetchCompanyCount();
      const totalEmployees = userData?.filter(u => u.role === 'EMPLOYEE').length || 0;
      
      // Fetch session counts
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('status', { count: 'exact' });
      
      if (sessionError) throw new Error(sessionError.message);
      
      const totalSessions = sessionData?.length || 0;
      const activeSessions = sessionData?.filter(s => s.status === 'IN_PROGRESS').length || 0;
      const completedSessions = sessionData?.filter(s => s.status === 'COMPLETED').length || 0;
      const pendingSessions = sessionData?.filter(s => s.status === 'PENDING').length || 0;
      
      // Fetch total coins in the system
      const { data: coinData, error: coinError } = await supabase
        .from('users')
        .select('coins');
      
      if (coinError) throw new Error(coinError.message);
      
      const totalCoins = coinData?.reduce((sum, user) => sum + (user.coins || 0), 0) || 0;
      
      setStats({
        totalUsers,
        totalAdmins,
        totalCompanies,
        totalEmployees,
        totalSessions,
        totalCoins,
        activeSessions,
        completedSessions,
        pendingSessions
      });
    } catch (err) {
      console.error('Error fetching system stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to load system statistics');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanyCount = async (): Promise<number> => {
    try {
      const { count, error } = await supabase
        .from('companies')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error fetching company count:', error);
      return 0;
    }
  };

  const fetchRecentActivities = async () => {
    try {
      setLoadingActivities(true);
      
      let query = supabase
        .from('activity_logs')
        .select(`
          *,
          user:users(id, name, email, role)
        `)
        .order('createdAt', { ascending: false })
        .limit(10);
      
      // Apply time filter if not "all"
      if (timePeriod !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        if (timePeriod === 'day') {
          startDate.setDate(now.getDate() - 1);
        } else if (timePeriod === 'week') {
          startDate.setDate(now.getDate() - 7);
        } else if (timePeriod === 'month') {
          startDate.setMonth(now.getMonth() - 1);
        }
        
        query = query.gte('createdAt', startDate.toISOString());
      }
      
      const { data, error } = await query;
      
      if (error) throw new Error(error.message);
      
      setRecentActivities(data || []);
    } catch (err) {
      console.error('Error fetching recent activities:', err);
    } finally {
      setLoadingActivities(false);
    }
  };

  const handleRefresh = () => {
    fetchSystemStats();
    fetchRecentActivities();
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (error) {
      return dateString;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE':
        return 'success.main';
      case 'UPDATE':
        return 'info.main';
      case 'DELETE':
        return 'error.main';
      case 'LOGIN':
        return 'primary.main';
      case 'LOGOUT':
        return 'warning.main';
      default:
        return 'text.primary';
    }
  };

  const handleTimePeriodChange = (event: any) => {
    setTimePeriod(event.target.value);
  };

  if (!session?.user) {
    return <Alert severity="error">Authentication required</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 'medium' }}>
          System Statistics
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="time-period-label">Time Period</InputLabel>
            <Select
              labelId="time-period-label"
              id="time-period"
              value={timePeriod}
              label="Time Period"
              onChange={handleTimePeriodChange}
            >
              <MenuItem value="day">Last 24 Hours</MenuItem>
              <MenuItem value="week">Last 7 Days</MenuItem>
              <MenuItem value="month">Last 30 Days</MenuItem>
              <MenuItem value="all">All Time</MenuItem>
            </Select>
          </FormControl>
          
          <Button 
            variant="outlined" 
            startIcon={<RefreshCcw size={16} />} 
            onClick={handleRefresh}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

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
      ) : (
        <>
          {/* Summary Cards */}
          <MuiGrid container spacing={3} sx={{ mb: 4 }}>
            {/* Users Card */}
            <MuiGrid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card elevation={2}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Total Users
                      </Typography>
                      <Typography variant="h4" fontWeight="medium">
                        {stats.totalUsers}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {stats.totalAdmins} Admins • {stats.totalEmployees} Employees
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        backgroundColor: 'primary.light',
                        borderRadius: '50%',
                        width: 48,
                        height: 48,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Users color="#1976d2" />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </MuiGrid>
            
            {/* Companies Card */}
            <MuiGrid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card elevation={2}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Companies
                      </Typography>
                      <Typography variant="h4" fontWeight="medium">
                        {stats.totalCompanies}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Registered in the system
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        backgroundColor: 'success.light',
                        borderRadius: '50%',
                        width: 48,
                        height: 48,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Building color="#2e7d32" />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </MuiGrid>
            
            {/* Sessions Card */}
            <MuiGrid size={{ xs: 12, sm: 6, md: 4 }}>
              <Card elevation={2}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Total Trips
                      </Typography>
                      <Typography variant="h4" fontWeight="medium">
                        {stats.totalSessions}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {stats.activeSessions} Active • {stats.completedSessions} Completed
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        backgroundColor: 'info.light',
                        borderRadius: '50%',
                        width: 48,
                        height: 48,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Car color="#0288d1" />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </MuiGrid>
            
            {/* Coins Card */}
            <MuiGrid size={{ xs: 12, sm: 6, md: 6 }}>
              <Card elevation={2}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Total Coins
                      </Typography>
                      <Typography variant="h4" fontWeight="medium">
                        {stats.totalCoins.toLocaleString()}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        Available in the system
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        backgroundColor: 'warning.light',
                        borderRadius: '50%',
                        width: 48,
                        height: 48,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Coins color="#ed6c02" />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </MuiGrid>
            
            {/* System Health Card */}
            <MuiGrid size={{ xs: 12, sm: 6, md: 6 }}>
              <Card elevation={2}>
                <CardContent>
                  <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        System Health
                      </Typography>
                      <Typography variant="h4" fontWeight="medium" color="success.main">
                        Good
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        All services operational
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        backgroundColor: 'success.light',
                        borderRadius: '50%',
                        width: 48,
                        height: 48,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Database color="#2e7d32" />
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </MuiGrid>
          </MuiGrid>
          
          {/* Recent Activity */}
          <Box sx={{ mt: 4 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Recent System Activity
            </Typography>
            
            {loadingActivities ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress size={30} />
              </Box>
            ) : recentActivities.length === 0 ? (
              <Alert severity="info">
                No recent activities found for the selected time period.
              </Alert>
            ) : (
              <TableContainer component={Paper}>
                <Table sx={{ minWidth: 650 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Resource</TableCell>
                      <TableCell>Details</TableCell>
                      <TableCell>Timestamp</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentActivities.map((activity) => (
                      <TableRow key={activity.id}>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {activity.user?.name || 'Unknown'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {activity.user?.email || 'No email'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography
                            variant="body2"
                            fontWeight="medium"
                            color={getActionColor(activity.action)}
                          >
                            {activity.action}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {activity.targetResourceType || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 250 }}>
                            {activity.details ? 
                              (typeof activity.details === 'string' 
                                ? activity.details.substring(0, 50) + (activity.details.length > 50 ? '...' : '')
                                : JSON.stringify(activity.details).substring(0, 50) + '...'
                              ) 
                              : 'No details'
                            }
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDate(activity.createdAt)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </>
      )}
    </Box>
  );
} 
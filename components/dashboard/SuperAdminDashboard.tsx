"use client";

import { useState, useEffect, useContext } from "react";
import Link from "next/link";
import { SuperAdminDashboardProps } from "./types";
import { 
  CircularProgress, 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Button, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogContentText, 
  DialogActions,
  Tabs,
  Tab,
  Paper,
  Divider,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CardHeader,
  IconButton,
  Tooltip,
  SelectChangeEvent,
  Stack,
  Container,
  Grid as MuiGrid
} from "@mui/material";
import { format } from "date-fns";
import TransferCoinsForm from "../coins/TransferCoinsForm";
import SuperAdminTransferCoinsForm from "../coins/SuperAdminTransferCoinsForm";
import TransactionHistory from "../coins/TransactionHistory";
import { useSession } from "next-auth/react";
import { SessionUpdateContext } from "@/app/dashboard/layout";
import { toast } from "react-hot-toast";
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import BadgeIcon from '@mui/icons-material/Badge';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import ListAltIcon from '@mui/icons-material/ListAlt';

// Fix for TypeScript errors with Grid
// @ts-ignore
const Grid = MuiGrid;

interface AdminUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  coins: number;
  hasCreatedResources: boolean;
}

export default function SuperAdminDashboard({ user: initialUser }: SuperAdminDashboardProps) {
  const { data: session, update: updateSession } = useSession();
  const { refreshUserSession } = useContext(SessionUpdateContext);
  const [activeTab, setActiveTab] = useState("admins");
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(initialUser);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalAdmins: 0,
    totalCompanies: 0,
    totalEmployees: 0,
    totalCoins: 0,
    totalSessions: 0,
    totalSeals: 0
  });
  const [detailedStats, setDetailedStats] = useState<any>({
    sessions: {
      byStatus: [],
      completionRate: 0,
      avgDuration: 0
    },
    users: {
      byRole: [],
      activeUsers: 0,
      activePercentage: 0
    },
    companies: {
      active: 0,
      inactive: 0,
      activePercentage: 0
    },
    seals: {
      byVerification: [],
      verifiedPercentage: 0
    },
    system: {
      recentActivity: 0,
      activityTrend: [],
      errorRate: 0
    }
  });
  const [statsPeriod, setStatsPeriod] = useState('week');
  const [statsTab, setStatsTab] = useState(0);
  const [refreshTransactions, setRefreshTransactions] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<string | null>(null);
  const [adminToDeleteName, setAdminToDeleteName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Fetch admins if on admins tab
  useEffect(() => {
    if (activeTab === "admins") {
      fetchAdmins();
    } else if (activeTab === "stats") {
      fetchStats();
    }
  }, [activeTab]);

  // Fetch current user data
  const fetchCurrentUser = async () => {
    try {
      try {
        const response = await fetch(`/api/users/${session?.user?.id || initialUser.id}`);
        const data = await response.json();
        
        if (data.user) {
          setCurrentUser(data.user);
          // Update session to reflect the latest user data
          await refreshUserSession();
          return;
        }
      } catch (err) {
        console.error("Error fetching user details, trying fallback:", err);
      }
      
      // Fallback: try /api/users/me endpoint
      try {
        const meResponse = await fetch('/api/users/me');
        const meData = await meResponse.json();
        
        if (meData.id) {
          setCurrentUser(meData);
          // Update session to reflect the latest user data
          await refreshUserSession();
        }
      } catch (meErr) {
        console.error("Error in fallback user fetch:", meErr);
        // If all else fails, keep using initialUser from props
      }
    } catch (err) {
      console.error("Error fetching current user (all attempts failed):", err);
    }
  };

  // Fetch admins
  const fetchAdmins = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admins");
      const data = await response.json();
      
      if (data.admins) {
        setAdmins(data.admins);
      }
    } catch (err) {
      console.error("Error fetching admins:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch system stats
  const fetchStats = async () => {
    setLoading(true);
    try {
      // Use stats endpoint
      const response = await fetch(`/api/stats?period=${statsPeriod}`);
      const data = await response.json();
      
      if (data.stats) {
        setStats(data.stats);
        setDetailedStats({
          sessions: data.sessions || {},
          users: data.users || {},
          companies: data.companies || {},
          seals: data.seals || {},
          system: data.system || {}
        });
        setLoading(false);
        return;
      }
    } catch (statErr) {
      console.error("Error fetching from /api/stats:", statErr);
      
      // Fallback to superadmin dashboard endpoint
      try {
        const fallbackResponse = await fetch("/api/dashboard/superadmin");
        const fallbackData = await fallbackResponse.json();
        
        if (fallbackData.systemStats) {
          setStats({
            totalUsers: fallbackData.systemStats.admins + fallbackData.systemStats.companies + fallbackData.systemStats.employees + 1, // +1 for superadmin
            totalAdmins: fallbackData.systemStats.admins,
            totalCompanies: fallbackData.systemStats.companies,
            totalEmployees: fallbackData.systemStats.employees,
            totalCoins: fallbackData.coinFlow?.totalCoins || 0,
            totalSessions: 0,
            totalSeals: 0
          });
        }
      } catch (fallbackErr) {
        console.error("Error fetching stats (fallback failed):", fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "MMM dd, yyyy HH:mm:ss");
  };

  // Handle successful coin transfer
  const handleTransferSuccess = async () => {
    // Increment to trigger a refresh of the transaction history
    setRefreshTransactions(prev => prev + 1);
    // Fetch updated user data to get the new coin balance
    await fetchCurrentUser();
    
    // Force update session to ensure latest coin balance
    if (updateSession) {
      try {
        await updateSession();
      } catch (err) {
        console.error("Error updating session after coin transfer:", err);
      }
    }
  };

  // Handle admin deletion
  const handleDeleteAdmin = async () => {
    if (!adminToDelete) return;
    
    setDeleteLoading(true);
    setDeleteError(null);
    
    try {
      console.log(`Attempting to delete admin with ID: ${adminToDelete}`);
      
      const response = await fetch(`/api/admins/${adminToDelete}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      console.log(`Delete API response status: ${response.status}`);
      
      const data = await response.json();
      console.log("Delete API response data:", data);

      if (!response.ok) {
        // Check if this is a resource constraint error
        if (data.resourceCount && data.resourceCount > 0) {
          throw new Error(
            `This admin has created ${data.resourceCount} resources. ` +
            `Please reassign or delete their resources first.`
          );
        }
        throw new Error(data.error || 'Failed to delete admin');
      }

      toast.success('Admin deleted successfully');
      // Update the UI by removing the deleted admin
      setAdmins(admins.filter((admin) => admin.id !== adminToDelete));
      // Close the dialog after successful deletion
      setDeleteDialogOpen(false);
      setAdminToDelete(null);
      setAdminToDeleteName("");
    } catch (err) {
      console.error('Error deleting admin:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete admin';
      setDeleteError(errorMessage);
      toast.error(errorMessage);
      // Keep the dialog open if there was an error
    } finally {
      setDeleteLoading(false);
    }
  };

  // Effect to refresh balance when coins tab is active
  useEffect(() => {
    if (activeTab === "coins") {
      fetchCurrentUser();
    }
  }, [activeTab]);
  
  // Effect to update currentUser when session changes
  useEffect(() => {
    if (session?.user) {
      setCurrentUser(prevUser => ({
        ...prevUser,
        coins: session.user.coins
      }));
    }
  }, [session?.user?.coins]);

  // Effect to update stats when period changes
  useEffect(() => {
    if (activeTab === "stats") {
      fetchStats();
    }
  }, [statsPeriod]);

  // Handle stats period change
  const handleStatsPeriodChange = (event: SelectChangeEvent) => {
    setStatsPeriod(event.target.value as string);
  };

  // Handle stats tab change
  const handleStatsTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setStatsTab(newValue);
  };

  // Prepare data for charts
  const prepareSessionStatusData = () => {
    if (!detailedStats.sessions.byStatus || detailedStats.sessions.byStatus.length === 0) {
      return [];
    }
    
    return detailedStats.sessions.byStatus.map((status: any) => ({
      name: status.status,
      value: status._count
    }));
  };

  const prepareUserRoleData = () => {
    if (!detailedStats.users.byRole || detailedStats.users.byRole.length === 0) {
      return [];
    }
    
    return detailedStats.users.byRole.map((role: any) => ({
      name: role.role,
      value: role._count
    }));
  };

  const prepareActivityTrendData = () => {
    if (!detailedStats.system.activityTrend || detailedStats.system.activityTrend.length === 0) {
      return [];
    }
    
    return detailedStats.system.activityTrend.map((day: any) => ({
      date: format(new Date(day.day), 'MMM dd'),
      activities: day.count
    }));
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">SuperAdmin Dashboard</h2>
        <p className="text-gray-600">
          Welcome, {currentUser.name}. You can manage admins, view system-wide stats, and transfer coins.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab("admins")}
              className={`py-4 px-6 ${
                activeTab === "admins"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Admins
            </button>
            <button
              onClick={() => setActiveTab("stats")}
              className={`py-4 px-6 ${
                activeTab === "stats"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              System Stats
            </button>
            <Link
              href="/dashboard/sessions"
              className={`py-4 px-6 text-gray-500 hover:text-gray-700 hover:border-gray-300`}
            >
              Session Management
            </Link>
            <button
              onClick={() => setActiveTab("coins")}
              className={`py-4 px-6 ${
                activeTab === "coins"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Coin Management
            </button>
            <Link 
              href="/dashboard/activity-logs"
              className="py-4 px-6 text-gray-500 hover:text-gray-700 hover:border-gray-300"
            >
              Activity Logs
            </Link>
          </nav>
        </div>

        <div className="p-6">
          {/* Coins Tab Content */}
          {activeTab === "coins" && (
            <div>
              <h3 className="text-lg font-medium mb-4">Coin Management</h3>
              <div className="bg-gray-100 p-6 rounded-md mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium mb-2">Your Coin Balance</h4>
                    <p className="text-3xl font-bold text-yellow-600">
                      {session?.user?.coins} Coins
                    </p>
                  </div>
                  <Button 
                    variant="outlined" 
                    color="primary" 
                    size="small"
                    onClick={async () => {
                      // Perform a full refresh of both local state and session
                      await fetchCurrentUser();
                      if (updateSession) {
                        await updateSession();
                      }
                      // Explicitly refresh the transaction history as well
                      setRefreshTransactions(prev => prev + 1);
                    }}
                  >
                    Refresh Balance
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* SuperAdmin to Admin Transfer Coins Form */}
                <div>
                  <h4 className="font-medium mb-2">Transfer Coins to Admins</h4>
                  <SuperAdminTransferCoinsForm 
                    currentBalance={session?.user?.coins || 0} 
                    onSuccess={handleTransferSuccess} 
                  />
                </div>
                
                {/* Transaction History */}
                <div>
                  <h4 className="font-medium mb-2">Transaction History</h4>
                  <TransactionHistory refreshTrigger={refreshTransactions} />
                </div>
              </div>
            </div>
          )}
          
          {/* Admins Tab Content */}
          {activeTab === "admins" && (
            <div>
              <h3 className="text-lg font-medium mb-4">Manage Admins</h3>
              
              <div className="mb-4">
                <Link 
                  href="/dashboard/admins/create" 
                  className="inline-block bg-blue-600 text-white px-4 py-2 rounded-md font-medium hover:bg-blue-700"
                >
                  Create New Admin
                </Link>
              </div>
              
              {loading ? (
                <div className="flex justify-center p-6">
                  <CircularProgress />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {admins.map((admin) => (
                    <Card key={admin.id} variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {admin.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {admin.email}
                        </Typography>
                        <Box display="flex" justifyContent="space-between" mt={2}>
                          <Typography variant="body2" color="text.secondary">
                            Created: {formatDate(admin.createdAt)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Coins: {admin.coins}
                          </Typography>
                        </Box>
                        <Box display="flex" justifyContent="space-between" mt={2}>
                          <Link 
                            href={`/dashboard/admins/${admin.id}`}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Details
                          </Link>
                          {!admin.hasCreatedResources && (
                            <button 
                              onClick={() => {
                                setAdminToDelete(admin.id);
                                setAdminToDeleteName(admin.name);
                                setDeleteDialogOpen(true);
                              }}
                              className="text-red-600 hover:text-red-800 bg-transparent border-none cursor-pointer p-0"
                            >
                              Delete
                            </button>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Stats Tab Content */}
          {activeTab === "stats" && (
            <div>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" fontWeight="medium">System Statistics</Typography>
                <Box display="flex" alignItems="center">
                  <FormControl variant="outlined" size="small" sx={{ mr: 2, minWidth: 120 }}>
                    <InputLabel id="stats-period-label">Time Period</InputLabel>
                    <Select
                      labelId="stats-period-label"
                      id="stats-period"
                      value={statsPeriod}
                      onChange={handleStatsPeriodChange}
                      label="Time Period"
                    >
                      <MenuItem value="day">Last 24 Hours</MenuItem>
                      <MenuItem value="week">Last 7 Days</MenuItem>
                      <MenuItem value="month">Last 30 Days</MenuItem>
                      <MenuItem value="all">All Time</MenuItem>
                    </Select>
                  </FormControl>
                  <Tooltip title="Refresh Statistics">
                    <IconButton onClick={fetchStats} color="primary">
                      <RefreshIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
              
              {loading ? (
                <Box display="flex" flexDirection="column" alignItems="center" p={4}>
                  <CircularProgress size={40} />
                  <Typography variant="body2" color="text.secondary" mt={2}>
                    Loading system statistics...
                  </Typography>
                </Box>
              ) : (
                <>
                  {/* Summary Cards */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
                    {/* Users Card */}
                    <Box sx={{ flex: '1 1 200px', minWidth: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(25% - 18px)' } }}>
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
                              <PeopleIcon sx={{ color: 'primary.main' }} />
                            </Box>
                          </Box>
                          {detailedStats.users.activePercentage > 0 && (
                            <Box mt={2}>
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="caption" color="text.secondary">
                                  Active Users
                                </Typography>
                                <Typography variant="caption" color="primary">
                                  {detailedStats.users.activeUsers} ({detailedStats.users.activePercentage}%)
                                </Typography>
                              </Box>
                              <LinearProgress 
                                variant="determinate" 
                                value={detailedStats.users.activePercentage} 
                                sx={{ mt: 0.5, height: 5, borderRadius: 1 }}
                              />
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Box>
                    
                    {/* Companies Card */}
                    <Box sx={{ flex: '1 1 200px', minWidth: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(25% - 18px)' } }}>
                      <Card elevation={2}>
                        <CardContent>
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Total Companies
                              </Typography>
                              <Typography variant="h4" fontWeight="medium">
                                {stats.totalCompanies}
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
                              <BusinessIcon sx={{ color: 'info.main' }} />
                            </Box>
                          </Box>
                          {detailedStats.companies.activePercentage > 0 && (
                            <Box mt={2}>
                              <Box display="flex" justifyContent="space-between" alignItems="center">
                                <Typography variant="caption" color="text.secondary">
                                  Active Companies
                                </Typography>
                                <Typography variant="caption" color="info.main">
                                  {detailedStats.companies.active} ({detailedStats.companies.activePercentage}%)
                                </Typography>
                              </Box>
                              <LinearProgress 
                                variant="determinate" 
                                value={detailedStats.companies.activePercentage} 
                                sx={{ mt: 0.5, height: 5, borderRadius: 1, color: 'info.main', '& .MuiLinearProgress-bar': { bgcolor: 'info.main' } }}
                              />
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    </Box>
                    
                    {/* Employees Card */}
                    <Box sx={{ flex: '1 1 200px', minWidth: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(25% - 18px)' } }}>
                      <Card elevation={2}>
                        <CardContent>
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Total Employees
                              </Typography>
                              <Typography variant="h4" fontWeight="medium">
                                {stats.totalEmployees}
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
                              <BadgeIcon sx={{ color: 'success.main' }} />
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Box>
                    
                    {/* Coins Card */}
                    <Box sx={{ flex: '1 1 200px', minWidth: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(25% - 18px)' } }}>
                      <Card elevation={2}>
                        <CardContent>
                          <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                Total Coins
                              </Typography>
                              <Typography variant="h4" fontWeight="medium">
                                {stats.totalCoins}
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
                              <MonetizationOnIcon sx={{ color: 'warning.main' }} />
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Box>
                  </Box>
                  
                  {/* Sessions Overview */}
                  <Card elevation={2} sx={{ mb: 4 }}>
                    <CardHeader 
                      title="Sessions Overview" 
                      subheader={`Total Sessions: ${stats.totalSessions}`}
                    />
                    <Divider />
                    <CardContent>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        <Box sx={{ flex: '1 1 300px', minWidth: { xs: '100%', md: '30%' } }}>
                          <Box mb={2}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Session Completion Rate
                            </Typography>
                            <Box display="flex" alignItems="center">
                              <Typography variant="h5" fontWeight="medium" color="primary" mr={1}>
                                {detailedStats.sessions.completionRate || 0}%
                              </Typography>
                              {detailedStats.sessions.completionRate > 70 ? (
                                <TrendingUpIcon color="success" />
                              ) : (
                                <TrendingDownIcon color="error" />
                              )}
                            </Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={detailedStats.sessions.completionRate || 0} 
                              sx={{ mt: 1, height: 8, borderRadius: 1 }}
                            />
                          </Box>
                          
                          <Box>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Average Session Duration
                            </Typography>
                            <Typography variant="h5" fontWeight="medium" color="primary">
                              {detailedStats.sessions.avgDuration ? `${Math.floor(detailedStats.sessions.avgDuration / 3600)}h ${Math.floor((detailedStats.sessions.avgDuration % 3600) / 60)}m` : 'N/A'}
                            </Typography>
                          </Box>
                        </Box>
                        
                        <Box sx={{ flex: '1 1 300px', minWidth: { xs: '100%', md: '60%' } }}>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Sessions by Status
                          </Typography>
                          <Box height={240}>
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={prepareSessionStatusData()}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={60}
                                  outerRadius={90}
                                  fill="#8884d8"
                                  paddingAngle={2}
                                  dataKey="value"
                                  nameKey="name"
                                  label={(entry) => entry.name}
                                >
                                  {prepareSessionStatusData().map((entry: any, index: number) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                  ))}
                                </Pie>
                                <RechartsTooltip formatter={(value, name) => [`${value} Sessions`, name]} />
                                <Legend />
                              </PieChart>
                            </ResponsiveContainer>
                          </Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                  
                  {/* Users & Activity */}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
                    <Box sx={{ flex: '1 1 300px', minWidth: { xs: '100%', md: '45%' } }}>
                      <Card elevation={2} sx={{ height: '100%' }}>
                        <CardHeader title="User Distribution" />
                        <Divider />
                        <CardContent>
                          <Box height={300}>
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={prepareUserRoleData()}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <RechartsTooltip formatter={(value) => [`${value} Users`]} />
                                <Bar dataKey="value" fill="#8884d8" name="Users" />
                              </BarChart>
                            </ResponsiveContainer>
                          </Box>
                        </CardContent>
                      </Card>
                    </Box>
                    
                    <Box sx={{ flex: '1 1 300px', minWidth: { xs: '100%', md: '45%' } }}>
                      <Card elevation={2} sx={{ height: '100%' }}>
                        <CardHeader 
                          title="System Activity" 
                          subheader={`${detailedStats.system.recentActivity || 0} activities in the last 24 hours`}
                        />
                        <Divider />
                        <CardContent>
                          <Box height={300}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={prepareActivityTrendData()}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <RechartsTooltip formatter={(value) => [`${value} Activities`]} />
                                <Line type="monotone" dataKey="activities" stroke="#8884d8" activeDot={{ r: 8 }} name="Activities" />
                              </LineChart>
                            </ResponsiveContainer>
                          </Box>
                        </CardContent>
                      </Card>
                    </Box>
                  </Box>
                  
                  {/* System Health */}
                  <Card elevation={2}>
                    <CardHeader title="System Health" />
                    <Divider />
                    <CardContent>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                        <Box sx={{ flex: '1 1 300px', minWidth: { xs: '100%', md: '45%' } }}>
                          <Box mb={3}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Error Rate (Last 7 days)
                            </Typography>
                            <Box display="flex" alignItems="center">
                              <Typography 
                                variant="h5" 
                                fontWeight="medium" 
                                color={detailedStats.system.errorRate < 1 ? 'success.main' : detailedStats.system.errorRate < 5 ? 'warning.main' : 'error.main'} 
                                mr={1}
                              >
                                {detailedStats.system.errorRate || 0}%
                              </Typography>
                              {detailedStats.system.errorRate < 1 ? (
                                <TrendingDownIcon color="success" />
                              ) : (
                                <TrendingUpIcon color="error" />
                              )}
                            </Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={detailedStats.system.errorRate || 0} 
                              sx={{ 
                                mt: 1, 
                                height: 8, 
                                borderRadius: 1,
                                '& .MuiLinearProgress-bar': { 
                                  bgcolor: detailedStats.system.errorRate < 1 ? 'success.main' : detailedStats.system.errorRate < 5 ? 'warning.main' : 'error.main'
                                }
                              }}
                            />
                          </Box>
                        </Box>
                        
                        <Box sx={{ flex: '1 1 300px', minWidth: { xs: '100%', md: '45%' } }}>
                          <Box mb={3}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                              Seal Verification Rate
                            </Typography>
                            <Box display="flex" alignItems="center">
                              <Typography 
                                variant="h5" 
                                fontWeight="medium" 
                                color={detailedStats.seals.verifiedPercentage > 80 ? 'success.main' : 'warning.main'} 
                                mr={1}
                              >
                                {detailedStats.seals.verifiedPercentage || 0}%
                              </Typography>
                              {detailedStats.seals.verifiedPercentage > 80 ? (
                                <TrendingUpIcon color="success" />
                              ) : (
                                <TrendingDownIcon color="warning" />
                              )}
                            </Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={detailedStats.seals.verifiedPercentage || 0} 
                              sx={{ 
                                mt: 1, 
                                height: 8, 
                                borderRadius: 1,
                                '& .MuiLinearProgress-bar': { 
                                  bgcolor: detailedStats.seals.verifiedPercentage > 80 ? 'success.main' : 'warning.main'
                                }
                              }}
                            />
                          </Box>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          if (!deleteLoading) {
            setDeleteDialogOpen(false);
            setAdminToDelete(null);
            setAdminToDeleteName("");
            setDeleteError(null);
          }
        }}
      >
        <DialogTitle>Delete Admin User</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete admin <strong>{adminToDeleteName}</strong>? This action cannot be undone.
          </DialogContentText>
          {deleteError && (
            <Box mt={2} p={2} bgcolor="error.light" color="error.dark" borderRadius={1}>
              {deleteError}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setDeleteDialogOpen(false);
              setAdminToDelete(null);
              setAdminToDeleteName("");
              setDeleteError(null);
            }}
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteAdmin}
            color="error"
            disabled={deleteLoading}
          >
            {deleteLoading ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
} 
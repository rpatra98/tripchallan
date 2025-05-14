"use client";

import { useState, useEffect, useContext } from "react";
import Link from "next/link";
import { SuperAdminDashboardProps } from "./types";
import { CircularProgress, Card, CardContent, Typography, Box, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions } from "@mui/material";
import { format } from "date-fns";
import TransferCoinsForm from "../coins/TransferCoinsForm";
import SuperAdminTransferCoinsForm from "../coins/SuperAdminTransferCoinsForm";
import TransactionHistory from "../coins/TransactionHistory";
import { useSession } from "next-auth/react";
import { SessionUpdateContext } from "@/app/dashboard/layout";
import { toast } from "react-hot-toast";

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
  });
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
      // Use dashboard/superadmin endpoint as a fallback if stats endpoint fails
      try {
        const response = await fetch("/api/stats");
        const data = await response.json();
        
        if (data.stats) {
          setStats(data.stats);
          setLoading(false);
          return;
        }
      } catch (statErr) {
        console.error("Error fetching from /api/stats, trying fallback:", statErr);
      }
      
      // Fallback to superadmin dashboard endpoint
      const fallbackResponse = await fetch("/api/dashboard/superadmin");
      const fallbackData = await fallbackResponse.json();
      
      if (fallbackData.systemStats) {
        setStats({
          totalUsers: fallbackData.systemStats.admins + fallbackData.systemStats.companies + fallbackData.systemStats.employees + 1, // +1 for superadmin
          totalAdmins: fallbackData.systemStats.admins,
          totalCompanies: fallbackData.systemStats.companies,
          totalEmployees: fallbackData.systemStats.employees,
          totalCoins: fallbackData.coinFlow?.totalCoins || 0
        });
      }
    } catch (err) {
      console.error("Error fetching stats (all attempts failed):", err);
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return format(date, "MMM dd, yyyy");
  };

  // Handle successful coin transfer
  const handleTransferSuccess = async () => {
    // Increment to trigger a refresh of the transaction history
    setRefreshTransactions(prev => prev + 1);
    // Fetch updated user data to get the new coin balance
    await fetchCurrentUser();
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

  // Initial load of stats if that's the active tab
  useEffect(() => {
    if (activeTab === "stats") {
      fetchStats();
    }
  }, []);

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
                      {session?.user?.coins !== undefined ? session.user.coins : currentUser.coins} Coins
                    </p>
                  </div>
                  <Button 
                    variant="outlined" 
                    color="primary" 
                    size="small"
                    onClick={fetchCurrentUser}
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
                    currentBalance={session?.user?.coins || currentUser.coins} 
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
              <h3 className="text-lg font-medium mb-4">System Statistics</h3>
              
              {loading ? (
                <div className="flex justify-center p-6">
                  <CircularProgress />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        Total Users
                      </Typography>
                      <Typography variant="h4">
                        {stats.totalUsers}
                      </Typography>
                    </CardContent>
                  </Card>
                  
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        Total Companies
                      </Typography>
                      <Typography variant="h4">
                        {stats.totalCompanies}
                      </Typography>
                    </CardContent>
                  </Card>
                  
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        Total Employees
                      </Typography>
                      <Typography variant="h4">
                        {stats.totalEmployees}
                      </Typography>
                    </CardContent>
                  </Card>
                  
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        Total Coins in System
                      </Typography>
                      <Typography variant="h4">
                        {stats.totalCoins}
                      </Typography>
                    </CardContent>
                  </Card>
                </div>
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
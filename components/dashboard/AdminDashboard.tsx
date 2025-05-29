"use client";

import { useState, useEffect, useContext } from "react";
import Link from "next/link";
import { AdminDashboardProps } from "./types";
import { 
  CircularProgress, 
  Chip, 
  Card, 
  CardContent, 
  Typography, 
  Box,
  Alert,
  Button
} from "@mui/material";
import { Person, Work, Business } from "@mui/icons-material";
import { format } from "date-fns";
import TransferCoinsForm from "../coins/TransferCoinsForm";
import TransactionHistory from "../coins/TransactionHistory";
import { useSession } from "next-auth/react";
import { SessionUpdateContext } from "@/app/dashboard/layout";

interface CompanyData {
  id: string;
  name: string;
  email: string;
  createdAt: string | Date;
  companyId?: string;
  _count?: {
    employees: number;
  };
  companyUserId?: string;
  isActive?: boolean;
}

interface EmployeeData {
  id: string;
  name: string;
  email: string;
  role: string;
  subrole?: string | null;
  coins: number;
  createdAt: string | Date;
  company?: CompanyData;
}

// Add a helper function before the component to ensure we're using the right company ID
function getCompanyLinkId(company: CompanyData) {
  // Make sure we use the complete, non-truncated ID
  // First check if companyUserId exists, otherwise use company.id
  const id = company.companyUserId || company.id;
  
  // Ensure the ID is not truncated and is properly formatted
  if (!id || typeof id !== 'string') {
    console.error("Invalid company ID:", id);
    return "invalid-id"; // Fallback
  }
  
  return id;
}

// Helper function to check company active status - matches the details page logic
function isCompanyActive(company: CompanyData): boolean {
  // This precisely matches the condition in the company details page
  return company.isActive === true;
}

export default function AdminDashboard({ user }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState("companies");
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshTransactions, setRefreshTransactions] = useState(0);
  const { data: session, update: updateSession } = useSession();
  const { refreshUserSession } = useContext(SessionUpdateContext);
  const [currentUser, setCurrentUser] = useState(user);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [viewingCompanyEmployees, setViewingCompanyEmployees] = useState(false);

  useEffect(() => {
    // Check for tab parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');
    if (tabParam && ['companies', 'employees', 'coins'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "companies") {
      fetchCompanies();
      // Reset the employee viewing state when switching to companies tab
      setViewingCompanyEmployees(false);
      setSelectedCompanyId(null);
    } else if (activeTab === "employees") {
      if (!viewingCompanyEmployees) {
        fetchEmployees();
      }
    } else if (activeTab === "coins") {
      fetchCurrentUser();
    }
  }, [activeTab]);

  const fetchCompanies = async () => {
    setLoading(true);
    setError("");
    
    try {
      // First attempt
      console.log("Fetching companies from API...");
      let retryCount = 0;
      const maxRetries = 3;
      let response;
      
      while (retryCount < maxRetries) {
        try {
          response = await fetch("/api/companies", {
            cache: 'no-store',
            headers: {
              'pragma': 'no-cache',
              'cache-control': 'no-cache'
            }
          });
          
          if (response.ok) {
            break; // Success, exit the retry loop
          } else {
            // If response not OK, wait and retry
            console.log(`Attempt ${retryCount + 1} failed, status: ${response.status}. Retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            retryCount++;
          }
        } catch (fetchError) {
          console.error(`Fetch error on attempt ${retryCount + 1}:`, fetchError);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          retryCount++;
        }
      }
      
      if (!response || !response.ok) {
        throw new Error(response ? `API returned ${response.status}` : "Failed to fetch companies");
      }
      
      const data = await response.json();
      console.log("Fetched company data:", data);
      
      // Don't process isActive here - use it as-is to match details page
      setCompanies(data);
    } catch (err) {
      console.error("Error fetching companies:", err);
      setError(err instanceof Error ? err.message : "Failed to load companies");
      
      // If there's an error, try to show any companies we might have from before
      // This prevents a blank screen if the refresh fails
      if (companies.length > 0) {
        console.log("Using cached company data from previous fetch");
      } else {
        // If we have no companies at all, set an empty array to show "no companies" message
        setCompanies([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    setLoading(true);
    setError("");
    setViewingCompanyEmployees(false);
    setSelectedCompanyId(null);
    
    try {
      console.log("Fetching all employees for admin...");
      
      // Use retry logic with exponential backoff
      let retryCount = 0;
      const maxRetries = 3;
      let response;
      
      while (retryCount < maxRetries) {
        try {
          // Use the improved API endpoint that allows admins to fetch all employees
          response = await fetch("/api/employees?limit=100", {
            cache: 'no-store',
            headers: {
              'pragma': 'no-cache',
              'cache-control': 'no-cache'
            }
          });
          
          if (response.ok) {
            break; // Success, exit the retry loop
          } else {
            // If response not OK, wait and retry
            console.log(`Attempt ${retryCount + 1} failed, status: ${response.status}. Retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            retryCount++;
          }
        } catch (fetchError) {
          console.error(`Fetch error on attempt ${retryCount + 1}:`, fetchError);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          retryCount++;
        }
      }
      
      console.log("Response status:", response?.status);
      
      if (!response || !response.ok) {
        const errorText = response ? await response.text() : "No response";
        console.error("Error response:", errorText);
        throw new Error(`Failed to fetch employees: ${response?.status || 'No response'} ${errorText}`);
      }
      
      const employeeData = await response.json();
      console.log("Received employee data:", employeeData);
      console.log("Number of employees:", Array.isArray(employeeData) ? employeeData.length : "Not an array");
      
      setEmployees(employeeData);
    } catch (err) {
      console.error("Error fetching employees:", err);
      setError(err instanceof Error ? err.message : "Failed to load employees");
      
      // If there's an error, try to show any employees we might have from before
      // This prevents a blank screen if the refresh fails
      if (employees.length > 0) {
        console.log("Using cached employee data from previous fetch");
      } else {
        // If we have no employees at all, set an empty array to show "no employees" message
        setEmployees([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      // Use retry logic with exponential backoff
      let retryCount = 0;
      const maxRetries = 3;
      let response;
      
      while (retryCount < maxRetries) {
        try {
          response = await fetch(`/api/users/${session?.user?.id || user.id}`, {
            cache: 'no-store',
            headers: {
              'pragma': 'no-cache',
              'cache-control': 'no-cache'
            }
          });
          
          if (response.ok) {
            break; // Success, exit the retry loop
          } else {
            // If response not OK, wait and retry
            console.log(`Attempt ${retryCount + 1} failed, status: ${response.status}. Retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            retryCount++;
          }
        } catch (fetchError) {
          console.error(`Fetch error on attempt ${retryCount + 1}:`, fetchError);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          retryCount++;
        }
      }
      
      if (!response || !response.ok) {
        console.error(`Failed to fetch user data: ${response?.status}`);
        return;
      }
      
      const data = await response.json();
      
      if (data.user) {
        setCurrentUser(data.user);
        // Update session to reflect the latest user data
        await refreshUserSession();
        
        // If session update is available, update it directly too for immediate UI refresh
        if (session && updateSession) {
          await updateSession({
            ...session,
            user: {
              ...session.user,
              coins: data.user.coins,
            }
          });
        }
      }
    } catch (err) {
      console.error("Error fetching current user:", err);
      // Don't show an error message to the user for this one,
      // just silently log it - this keeps the UX cleaner
    }
  };

  const formatDate = (dateString: string | Date) => {
    return format(new Date(dateString), "MMM d, yyyy");
  };

  // Transform subrole for display
  const getSubroleLabel = (subrole: string | null) => {
    if (!subrole) return "No subrole";
    
    // Convert SNAKE_CASE to Title Case
    return subrole
      .toLowerCase()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Get chip color based on subrole
  const getSubroleColor = (subrole: string | null) => {
    if (!subrole) return "default";
    
    switch (subrole.toUpperCase()) {
      case "OPERATOR":
        return "primary";
      case "DRIVER":
        return "success";
      case "TRANSPORTER":
        return "info";
      case "GUARD":
        return "warning";
      default:
        return "default";
    }
  };

  // Handle successful coin transfer
  const handleTransferSuccess = async () => {
    // Increment to trigger a refresh of the transaction history
    setRefreshTransactions(prev => prev + 1);
    // Update the session to reflect the new coin balance
    await fetchCurrentUser();
  };

  // Use a more aggressive refresh strategy for coin balance
  useEffect(() => {
    // Initial load
    fetchCurrentUser();
    
    // Set up refresh on visibility change (tab focus)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCurrentUser();
      }
    };
    
    // Set up refresh on storage event (for cross-tab synchronization)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'coinBalanceUpdatedAt') {
        fetchCurrentUser();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('storage', handleStorageChange);
    
    // Refresh every 30 seconds while page is visible
    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchCurrentUser();
      }
    }, 30000);
    
    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(intervalId);
    };
  }, []);

  // Effect to refresh balance when coins tab is active
  useEffect(() => {
    if (activeTab === "coins") {
      fetchCurrentUser();
    }
  }, [activeTab]);

  const viewCompanyEmployees = async (companyId: string) => {
    setLoading(true);
    setError("");
    
    // Find the selected company
    const selectedCompany = companies.find(c => c.id === companyId);
    if (!selectedCompany) {
      setError("Company not found");
      setLoading(false);
      return;
    }
    
    // Use the actual company ID, not the user ID
    const actualCompanyId = selectedCompany.companyId || companyId;
    setSelectedCompanyId(companyId);
    
    try {
      console.log(`Fetching employees for company ${companyId} (actual company ID: ${actualCompanyId})`);
      
      // Use retry logic with exponential backoff
      let retryCount = 0;
      const maxRetries = 3;
      let response;
      
      while (retryCount < maxRetries) {
        try {
          // The companyId in the database is stored on employees, we need to pass it correctly
          response = await fetch(`/api/employees?companyId=${actualCompanyId}`, {
            cache: 'no-store',
            headers: {
              'pragma': 'no-cache',
              'cache-control': 'no-cache'
            }
          });
          
          if (response.ok) {
            break; // Success, exit the retry loop
          } else {
            // If response not OK, wait and retry
            console.log(`Attempt ${retryCount + 1} failed, status: ${response.status}. Retrying...`);
            await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
            retryCount++;
          }
        } catch (fetchError) {
          console.error(`Fetch error on attempt ${retryCount + 1}:`, fetchError);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          retryCount++;
        }
      }
      
      if (!response || !response.ok) {
        const errorText = response ? await response.text() : "No response";
        console.error("Error response:", errorText);
        throw new Error(`Failed to fetch company employees: ${response?.status || 'No response'} ${errorText}`);
      }
      
      const data = await response.json();
      console.log(`Fetched ${data.length} employees for company ${actualCompanyId}`);
      setEmployees(data);
      setViewingCompanyEmployees(true);
      setActiveTab("employees");
    } catch (err) {
      console.error("Error fetching company employees:", err);
      setError(err instanceof Error ? err.message : "Failed to load company employees");
      setViewingCompanyEmployees(false);
      
      // If we have existing employees data, maintain it
      if (employees.length > 0) {
        console.log("Keeping existing employee data");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">Admin Dashboard</h2>
        <p className="text-gray-600">
          Welcome, {user.name}. Manage companies, employees, and system coins.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex">
            <button
              onClick={() => setActiveTab("companies")}
              className={`py-4 px-6 ${
                activeTab === "companies"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Companies
            </button>
            <button
              onClick={() => setActiveTab("employees")}
              className={`py-4 px-6 ${
                activeTab === "employees"
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Employees
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
          {activeTab === "companies" && (
            <div>
              <Box 
                display="flex" 
                justifyContent="space-between" 
                alignItems="center" 
                mb={3}
              >
                <h3 className="text-lg font-medium">Companies</h3>
                <Link href="/dashboard/companies/create">
                  <Button variant="contained" color="primary">
                    Add Company
                  </Button>
                </Link>
              </Box>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}

              {loading ? (
                <Box display="flex" justifyContent="center" p={4}>
                  <CircularProgress />
                </Box>
              ) : companies.length === 0 ? (
                <div className="bg-gray-100 p-6 rounded-md text-center">
                  <p>No companies found. Start by adding a company.</p>
                  <Link href="/dashboard/companies/create">
                    <Button variant="contained" color="primary" sx={{ mt: 2 }}>
                      Add Your First Company
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {companies.map((company) => (
                    <Card key={company.id} variant="outlined">
                      <CardContent>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                          <Typography variant="h6" component="div">
                            {company.name}
                          </Typography>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            isCompanyActive(company) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {isCompanyActive(company) ? 'Active' : 'Inactive'}
                          </span>
                        </Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {company.email}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                          Created: {formatDate(company.createdAt)}
                        </Typography>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mt={1}>
                          <Chip 
                            label={`${company._count?.employees || 0} employees`} 
                            size="small" 
                            color="primary" 
                            variant="outlined"
                          />
                          <Box>
                            <Button 
                              size="small" 
                              variant="outlined" 
                              onClick={() => viewCompanyEmployees(company.id)}
                              sx={{ mr: 1 }}
                            >
                              View Employees
                            </Button>
                            <Link href={`/dashboard/companies/${getCompanyLinkId(company)}`}>
                              <Button size="small" variant="outlined">
                                Details
                              </Button>
                            </Link>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "employees" && (
            <div>
              <Box 
                display="flex" 
                justifyContent="space-between" 
                alignItems="center" 
                mb={3}
              >
                <Box display="flex" alignItems="center">
                  {viewingCompanyEmployees && (
                    <Button 
                      variant="outlined" 
                      size="small" 
                      onClick={() => {
                        setActiveTab("companies");
                      }}
                      sx={{ mr: 2 }}
                    >
                      ← Back to Companies
                    </Button>
                  )}
                  <h3 className="text-lg font-medium">
                    {viewingCompanyEmployees 
                      ? `Employees for ${companies.find(c => c.id === selectedCompanyId)?.name || 'Company'}`
                      : 'All Employees'
                    }
                  </h3>
                </Box>
                <Link href="/dashboard/employees/create">
                  <Button variant="contained" color="primary">
                    Add Employee
                  </Button>
                </Link>
              </Box>

              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}

              {loading ? (
                <Box display="flex" justifyContent="center" p={4}>
                  <CircularProgress />
                </Box>
              ) : employees.length === 0 ? (
                <div className="bg-gray-100 p-6 rounded-md text-center">
                  <p>
                    {viewingCompanyEmployees 
                      ? 'No employees found for this company.' 
                      : 'No employees found in the system.'
                    }
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {employees.map((employee) => (
                    <Card key={employee.id} variant="outlined">
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          {employee.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          {employee.email}
                        </Typography>
                        
                        <Box display="flex" mt={1} mb={2}>
                          <Chip 
                            label={employee.role.toLowerCase()}
                            size="small" 
                            color="primary" 
                            sx={{ mr: 1, textTransform: 'capitalize' }}
                          />
                          {employee.subrole && (
                            <Chip 
                              label={String(employee.subrole).toLowerCase().replace('_', ' ')} 
                              size="small" 
                              color="secondary" 
                              sx={{ textTransform: 'capitalize' }}
                            />
                          )}
                        </Box>

                        {employee.company && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Company: {employee.company.name}
                          </Typography>
                        )}
                        
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                          <Typography variant="caption" color="text.secondary">
                            Coins: {employee.coins}
                          </Typography>
                          <Link href={`/dashboard/employees/${employee.id}`}>
                            <Button size="small" variant="outlined">
                              View Details
                            </Button>
                          </Link>
                        </Box>
                        <Box display="flex" justifyContent="space-between" mt={2}>
                          <Box display="flex" alignItems="center">
                            <Typography variant="caption" color="text.secondary">
                              Joined: {formatDate(employee.createdAt)}
                            </Typography>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "coins" && (
            <div>
              <h3 className="text-lg font-medium mb-4">Coin Management</h3>
              <div className="bg-gray-100 p-6 rounded-md mb-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-medium mb-2">Your Coin Balance</h4>
                    <p className="text-3xl font-bold text-yellow-600">
                      {currentUser?.coins !== undefined ? currentUser.coins : session?.user?.coins || 0} Coins
                    </p>
                  </div>
                  <Button 
                    variant="outlined" 
                    color="primary" 
                    size="small"
                    onClick={async () => {
                      await fetchCurrentUser();
                      await refreshUserSession();
                    }}
                  >
                    Refresh Balance
                  </Button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Transfer Coins Form */}
                <div>
                  <h4 className="font-medium mb-2">Transfer Coins</h4>
                  <TransferCoinsForm 
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
        </div>
      </div>
    </div>
  );
} 
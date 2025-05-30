"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Box, Tabs, Tab, Typography, CircularProgress, Alert, Card, CardContent, Button } from "@mui/material";
import { testSupabaseConnection } from "@/lib/supabase";

export default function SuperAdminPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);

  // Check Supabase connection status
  useEffect(() => {
    const checkConnection = async () => {
      try {
        setCheckingConnection(true);
        const connected = await testSupabaseConnection();
        setSupabaseConnected(connected);
      } catch (error) {
        console.error("Error checking Supabase connection:", error);
        setSupabaseConnected(false);
      } finally {
        setCheckingConnection(false);
      }
    };

    checkConnection();
  }, []);

  // If user is not SuperAdmin, redirect to regular dashboard
  useEffect(() => {
    if (session?.user?.email !== "superadmin@cbums.com") {
      router.push("/dashboard");
    }
  }, [session, router]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  if (!session?.user) {
    return (
      <div className="container mx-auto mt-8 max-w-md">
        <div className="bg-white p-6 rounded-lg shadow-lg text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Authentication Required</h2>
          <p className="mb-4">Please log in as SuperAdmin to access this page.</p>
          <Link href="/" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mr: 2 }}>
          SuperAdmin Dashboard
        </Typography>
        
        {checkingConnection ? (
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Checking Supabase connection...
            </Typography>
          </Box>
        ) : supabaseConnected ? (
          <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'success.main', color: 'white', px: 1.5, py: 0.5, borderRadius: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
              Supabase Connected
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', bgcolor: 'error.main', color: 'white', px: 1.5, py: 0.5, borderRadius: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 'medium' }}>
              Supabase Disconnected
            </Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ width: '100%', mb: 3 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={activeTab} onChange={handleTabChange} aria-label="SuperAdmin dashboard tabs">
            <Tab label="Admin" />
            <Tab label="System Stats" />
            <Tab label="Trip Management" />
            <Tab label="Coin Management" />
            <Tab label="Activity Logs" />
          </Tabs>
        </Box>
      </Box>

      {/* Tab panels */}
      <Box sx={{ mt: 3 }}>
        {activeTab === 0 && (
          <iframe
            src="/dashboard/admins"
            style={{ width: '100%', height: 'calc(100vh - 200px)', border: 'none' }}
            title="Admin Management"
          />
        )}
        
        {activeTab === 1 && (
          <Box>
            <Typography variant="h5" component="h2" sx={{ mb: 3, fontWeight: 'medium' }}>
              System Statistics
            </Typography>
            
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4 }}>
              <Card sx={{ minWidth: 250, flex: '1 1 250px' }}>
                <CardContent>
                  <Typography variant="h6" component="div">
                    Total Users
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Typography variant="h4" color="primary">
                      Loading...
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
              
              <Card sx={{ minWidth: 250, flex: '1 1 250px' }}>
                <CardContent>
                  <Typography variant="h6" component="div">
                    Total Companies
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Typography variant="h4" color="success.main">
                      Loading...
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
              
              <Card sx={{ minWidth: 250, flex: '1 1 250px' }}>
                <CardContent>
                  <Typography variant="h6" component="div">
                    Total Trips
                  </Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Typography variant="h4" color="info.main">
                      Loading...
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
            
            <Button
              variant="contained"
              onClick={() => router.push('/dashboard/stats')}
              sx={{ mt: 2 }}
            >
              View Full Statistics
            </Button>
          </Box>
        )}
        
        {activeTab === 2 && (
          <iframe
            src="/dashboard/sessions"
            style={{ width: '100%', height: 'calc(100vh - 200px)', border: 'none' }}
            title="Trip Management"
          />
        )}
        
        {activeTab === 3 && (
          <Box>
            <Typography variant="h5" component="h2" sx={{ mb: 3, fontWeight: 'medium' }}>
              Coin Management
            </Typography>
            
            <Card sx={{ mb: 4 }}>
              <CardContent>
                <Typography variant="h6" color="warning.main">
                  Your Coin Balance
                </Typography>
                <Typography variant="h3" sx={{ mt: 2, fontWeight: 'bold', color: 'warning.main' }}>
                  {session.user.coins?.toLocaleString() || "Loading..."}
                </Typography>
              </CardContent>
            </Card>
            
            <Button
              variant="contained" 
              color="primary"
              onClick={() => router.push('/dashboard/coins')}
            >
              Manage Coins
            </Button>
          </Box>
        )}
        
        {activeTab === 4 && (
          <iframe
            src="/dashboard/activity-logs"
            style={{ width: '100%', height: 'calc(100vh - 200px)', border: 'none' }}
            title="Activity Logs"
          />
        )}
      </Box>
    </div>
  );
} 
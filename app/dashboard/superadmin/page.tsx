"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Box, Tabs, Tab, Typography, CircularProgress, Alert, Card, CardContent, Button } from "@mui/material";
import { testSupabaseConnection } from "@/lib/supabase";
import AdminManagement from "@/components/superadmin/AdminManagement";
import SystemStats from "@/components/superadmin/SystemStats";
import TripManagement from "@/components/superadmin/TripManagement";
import CoinManagement from "@/components/superadmin/CoinManagement";
import ActivityLogsTab from "@/components/superadmin/ActivityLogsTab";

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
      <Typography variant="h4" component="h1" sx={{ fontWeight: 'bold', mb: 3 }}>
        SuperAdmin Dashboard
      </Typography>
      
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
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
        {activeTab === 0 && <AdminManagement />}
        {activeTab === 1 && <SystemStats />}
        {activeTab === 2 && <TripManagement />}
        {activeTab === 3 && <CoinManagement />}
        {activeTab === 4 && <ActivityLogsTab />}
      </Box>
    </div>
  );
} 
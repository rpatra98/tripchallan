"use client";

import { useState, useEffect, useCallback } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Box, 
  Button, 
  Avatar, 
  Chip, 
  IconButton,
  CircularProgress,
  Tooltip,
  Alert,
  Snackbar
} from "@mui/material";
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { Coins, RefreshCcw, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function DashboardHeader() {
  const { data: session, update: updateSession } = useSession();
  const [userCoins, setUserCoins] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  // Create a memoized fetch function to avoid recreation on renders
  const fetchUserCoins = useCallback(async () => {
    if (!session?.user?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // First try API approach (handles SuperAdmin special logic)
      const response = await fetch('/api/users/me', { 
        cache: 'no-store',
        headers: {
          'pragma': 'no-cache',
          'cache-control': 'no-cache'
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        
        // Update local state
        setUserCoins(userData.coins || 0);
        
        // Update session
        if (session?.user && updateSession) {
          await updateSession({
            ...session,
            user: {
              ...session.user,
              coins: userData.coins
            }
          });
        }
        
        // Also save to localStorage for components that use it
        localStorage.setItem('lastCoinBalance', String(userData.coins || 0));
        localStorage.setItem('coinBalanceUpdatedAt', String(Date.now()));
        
        return;
      }
      
      // Fallback to direct Supabase query if API fails
      const { data, error } = await supabase
        .from('users')
        .select('coins')
        .eq('id', session.user.id)
        .single();
      
      if (error) {
        throw new Error(`Failed to fetch coins: ${error.message}`);
      }
      
      // Update local state
      setUserCoins(data.coins || 0);
      
      // Also update session state
      if (session?.user && updateSession) {
        await updateSession({
          ...session,
          user: {
            ...session.user,
            coins: data.coins || 0
          }
        });
      }
      
      // Also save to localStorage for components that use it
      localStorage.setItem('lastCoinBalance', String(data.coins || 0));
      localStorage.setItem('coinBalanceUpdatedAt', String(Date.now()));
    } catch (err) {
      console.error('Error fetching user coins:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch coin balance');
      setShowError(true);
    } finally {
      setLoading(false);
    }
  }, [session?.user?.id, session, updateSession]);

  // Fetch coins on initial render
  useEffect(() => {
    if (session?.user?.id) {
      fetchUserCoins();
    }
  }, [session?.user?.id, fetchUserCoins]);

  // Also check localStorage for recent updates
  useEffect(() => {
    const checkLocalStorage = () => {
      try {
        const lastCoinBalance = localStorage.getItem('lastCoinBalance');
        const updatedAt = localStorage.getItem('coinBalanceUpdatedAt');
        
        if (lastCoinBalance && updatedAt) {
          const updateTime = parseInt(updatedAt);
          const now = Date.now();
          
          // Only use if recent (within 30 seconds)
          if ((now - updateTime) < 30000) {
            setUserCoins(parseInt(lastCoinBalance));
          }
        }
      } catch (err) {
        console.error('Error checking localStorage:', err);
      }
    };
    
    checkLocalStorage();
    
    // Set up event listener for storage changes from other components
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'lastCoinBalance') {
        checkLocalStorage();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const handleRefresh = () => {
    fetchUserCoins();
    toast.success('Refreshing coin balance...');
  };

  const handleCloseError = () => {
    setShowError(false);
  };

  // Add a helper function to fix coins for SuperAdmin
  const handleFixCoins = async () => {
    if (session?.user?.role !== 'SUPERADMIN') return;
    
    try {
      setLoading(true);
      toast.success('Fixing coin balance...');
      
      // If we're a SuperAdmin, we should have 1,000,000 coins
      // Set this directly in local state and localStorage first for immediate feedback
      setUserCoins(1000000);
      localStorage.setItem('lastCoinBalance', '1000000');
      localStorage.setItem('coinBalanceUpdatedAt', String(Date.now()));
      
      // Then try to update the session
      if (session?.user && updateSession) {
        await updateSession({
          ...session,
          user: {
            ...session.user,
            coins: 1000000
          }
        });
      }
      
      // Fire off the API request to fix the database value
      // This is done asynchronously so we don't have to wait for it
      fetch('/api/admin/fix-superadmin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      }).then(async response => {
        if (response.ok) {
          toast.success('SuperAdmin coins fixed successfully!');
        } else {
          const data = await response.json();
          console.error('Error fixing coins:', data);
          toast.error('Failed to fix coins in database, but UI is updated');
        }
      }).catch(err => {
        console.error('Error calling fix-superadmin API:', err);
      });
    } catch (err) {
      console.error('Error fixing coins:', err);
      toast.error('Failed to fix coins');
    } finally {
      setLoading(false);
    }
  };

  if (!session?.user) {
    return null;
  }

  return (
    <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 'medium' }}>
        {session.user.role === 'SUPERADMIN' ? 'SuperAdmin Dashboard' : 
         session.user.role === 'ADMIN' ? 'Admin Dashboard' : 
         'Dashboard'}
      </Typography>
      
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {userCoins !== null ? (
          <Chip
            icon={<Coins size={16} />}
            label={`${userCoins.toLocaleString()} Coins`}
            color="warning"
            variant="outlined"
            sx={{ 
              fontWeight: 'bold',
              '& .MuiChip-label': { fontSize: '0.95rem' }
            }}
          />
        ) : loading ? (
          <Chip
            icon={<CircularProgress size={16} />}
            label="Loading coins..."
            color="default"
            variant="outlined"
          />
        ) : (
          <Tooltip title="Click to refresh coin balance">
            <Chip
              icon={<AlertCircle size={16} color="red" />}
              label="Coins unavailable"
              color="error"
              variant="outlined"
              onClick={handleRefresh}
              sx={{ 
                fontWeight: 'bold',
                '& .MuiChip-label': { fontSize: '0.95rem' }
              }}
            />
          </Tooltip>
        )}
        
        <Tooltip title="Refresh coin balance">
          <IconButton 
            size="small" 
            color="primary" 
            onClick={handleRefresh} 
            disabled={loading}
            sx={{ p: 1 }}
          >
            {loading ? <CircularProgress size={16} /> : <RefreshCcw size={16} />}
          </IconButton>
        </Tooltip>
        
        {/* Add a fix button for SuperAdmin users */}
        {session.user.role === 'SUPERADMIN' && (
          <Tooltip title="Fix SuperAdmin coins to 1,000,000">
            <Button
              size="small"
              variant="outlined"
              color="warning"
              onClick={handleFixCoins}
              disabled={loading}
              startIcon={<Coins size={16} />}
              sx={{ ml: 1 }}
            >
              {loading ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
              Fix Coins
            </Button>
          </Tooltip>
        )}
      </Box>
      
      <Snackbar
        open={showError}
        autoHideDuration={6000}
        onClose={handleCloseError}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert onClose={handleCloseError} severity="error">
          {error || 'Failed to fetch coin balance'}
        </Alert>
      </Snackbar>
    </Box>
  );
} 
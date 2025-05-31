"use client";

import { useState, useEffect } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Box, 
  Button, 
  Avatar, 
  Chip, 
  IconButton,
  CircularProgress
} from "@mui/material";
import { useSession } from 'next-auth/react';
import { supabase } from '@/lib/supabase';
import { Coins, RefreshCcw } from 'lucide-react';

export default function DashboardHeader() {
  const { data: session, update: updateSession } = useSession();
  const [userCoins, setUserCoins] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch user's coin balance directly from database
  const fetchUserCoins = async () => {
    if (!session?.user?.id) return;
    
    try {
      setLoading(true);
      
      // Get user's coins directly from database
      const { data, error } = await supabase
        .from('users')
        .select('coins')
        .eq('id', session.user.id)
        .single();
      
      if (error) {
        console.error('Error fetching user coins:', error);
        return;
      }
      
      // Update local state
      setUserCoins(data.coins || 0);
      
      // Also update session state
      if (data.coins !== undefined && session?.user && updateSession) {
        await updateSession({
          ...session,
          user: {
            ...session.user,
            coins: data.coins
          }
        });
      }
    } catch (err) {
      console.error('Error fetching user coins:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch coins on initial render
  useEffect(() => {
    if (session?.user?.id) {
      fetchUserCoins();
    }
  }, [session?.user?.id]);

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
            
            // Clear localStorage to avoid using stale data
            localStorage.removeItem('lastCoinBalance');
            localStorage.removeItem('coinBalanceUpdatedAt');
          }
        }
      } catch (err) {
        console.error('Error checking localStorage:', err);
      }
    };
    
    checkLocalStorage();
  }, []);

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
        <Chip
          icon={<Coins size={16} />}
          label={loading ? 'Loading...' : `${userCoins?.toLocaleString() || 0} Coins`}
          color="warning"
          variant="outlined"
          sx={{ 
            fontWeight: 'bold',
            '& .MuiChip-label': { fontSize: '0.95rem' }
          }}
        />
        
        <IconButton 
          size="small" 
          color="primary" 
          onClick={fetchUserCoins} 
          disabled={loading}
          sx={{ p: 1 }}
        >
          {loading ? <CircularProgress size={16} /> : <RefreshCcw size={16} />}
        </IconButton>
      </Box>
    </Box>
  );
} 
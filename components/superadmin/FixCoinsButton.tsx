"use client";

import { useState, useEffect } from 'react';
import { Button, CircularProgress, Alert, Box, Typography } from '@mui/material';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { Coins } from 'lucide-react';

export default function FixCoinsButton() {
  const { data: session, update: updateSession } = useSession();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  // Check if fix is needed
  useEffect(() => {
    const checkBalance = async () => {
      try {
        // Get current SuperAdmin data
        const response = await fetch('/api/admin/fix-superadmin', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) return;
        
        const data = await response.json();
        // Show button if balance needs fixing
        setVisible(data.needsAdjustment);
      } catch (err) {
        console.error('Error checking balance:', err);
      }
    };

    if (session?.user?.role === 'SUPERADMIN') {
      checkBalance();
    }
  }, [session?.user?.role]);

  const fixCoins = async () => {
    try {
      setLoading(true);
      setMessage(null);
      setError(null);

      // Call the API to fix the SuperAdmin coin balance
      const response = await fetch('/api/admin/fix-superadmin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fix coin balance');
      }

      setMessage(data.message);
      toast.success(data.message);

      // Refresh the session to update the coin balance
      if (session?.user) {
        await updateSession({
          ...session,
          user: {
            ...session.user,
            coins: data.newCoins
          }
        });
      }

      // Store the new balance in localStorage for immediate use
      localStorage.setItem('lastCoinBalance', data.newCoins.toString());
      localStorage.setItem('coinBalanceUpdatedAt', Date.now().toString());

      // Reload the page to reflect changes
      window.location.reload();
    } catch (err) {
      console.error('Error fixing coin balance:', err);
      setError(err instanceof Error ? err.message : 'Failed to fix coin balance');
      toast.error(err instanceof Error ? err.message : 'Failed to fix coin balance');
    } finally {
      setLoading(false);
    }
  };

  if (!session?.user || session.user.role !== 'SUPERADMIN' || !visible) {
    return null;
  }

  return (
    <Box sx={{ mb: 3, p: 2, border: '1px solid #ffcc80', borderRadius: 1, bgcolor: '#fff3e0' }}>
      <Typography variant="h6" sx={{ mb: 2, color: '#ed6c02', display: 'flex', alignItems: 'center' }}>
        <Coins size={20} style={{ marginRight: '8px' }} color="#ed6c02" />
        SuperAdmin Balance Issue Detected
      </Typography>
      
      <Typography variant="body1" sx={{ mb: 2 }}>
        Your coin balance appears to be incorrect. This may affect your ability to perform coin transactions.
        Click the button below to fix your balance and ensure all transactions are properly recorded.
      </Typography>
      
      {message && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {message}
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      <Button
        variant="contained"
        color="warning"
        onClick={fixCoins}
        disabled={loading}
        sx={{ mb: 1 }}
        startIcon={<Coins size={16} />}
        fullWidth
      >
        {loading ? (
          <>
            <CircularProgress size={16} sx={{ mr: 1 }} color="inherit" />
            Fixing Coin Balance...
          </>
        ) : (
          'Fix Coin Balance Now'
        )}
      </Button>
    </Box>
  );
} 
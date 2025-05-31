"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { 
  Box, 
  Typography, 
  Card, 
  CardContent, 
  Button, 
  TextField, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem, 
  Alert, 
  CircularProgress,
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Stack,
  InputAdornment,
  Divider,
  Chip
} from "@mui/material";
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import { 
  Coins, 
  RefreshCcw, 
  Plus, 
  Minus,
  Search,
  Calendar
} from "lucide-react";
import { toast } from "react-hot-toast";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/lib/enums";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  coins: number;
}

interface Transaction {
  id: string;
  amount: number;
  from_user_id?: string;
  to_user_id?: string;
  fromUserId?: string;
  toUserId?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  createdAt?: string;
  updatedAt?: string;
  fromUser?: {
    name: string;
    email: string;
    role?: string;
  };
  toUser?: {
    name: string;
    email: string;
    role?: string;
  };
}

// Transaction schema for form validation
const transactionSchema = Yup.object().shape({
  adminId: Yup.string().required('Please select an admin'),
  amount: Yup.number()
    .required('Amount is required')
    .integer('Amount must be a whole number')
    .min(1, 'Amount must be positive'),
  operation: Yup.string().required('Please select an operation'),
  reason: Yup.string().required('Reason is required'),
  notes: Yup.string()
});

export default function CoinManagement() {
  const { data: session, update: updateSession } = useSession();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactionError, setTransactionError] = useState<string | null>(null);
  const [currentUserCoins, setCurrentUserCoins] = useState(0);

  useEffect(() => {
    fetchAdmins();
    fetchTransactions();
    fetchCurrentUser();
  }, []);

  const fetchCurrentUser = async () => {
    if (!session?.user?.id) return;
    
    try {
      setLoading(true);
      
      // First try API approach for more reliable data
      try {
        const response = await fetch('/api/users/me', { 
          cache: 'no-store',
          headers: {
            'pragma': 'no-cache',
            'cache-control': 'no-cache'
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          console.log('Fetched user data from API:', userData);
          
          // Update local state
          setCurrentUserCoins(userData.coins || 0);
          
          // Update session
          if (session?.user) {
            await updateSession({
              ...session,
              user: {
                ...session.user,
                coins: userData.coins || 0
              }
            });
          }
          
          // Also save to localStorage for components that use it
          localStorage.setItem('lastCoinBalance', String(userData.coins || 0));
          localStorage.setItem('coinBalanceUpdatedAt', String(Date.now()));
          
          setLoading(false);
          return;
        }
      } catch (apiErr) {
        console.error('Error fetching from API:', apiErr);
        // Continue to fallback method
      }
      
      // Fallback to direct Supabase query
      const { data, error } = await supabase
        .from('users')
        .select('coins')
        .eq('id', session.user.id)
        .single();
      
      if (error) {
        console.error('Error fetching current user:', error);
        
        // Check localStorage as a last resort
        try {
          const lastCoinBalance = localStorage.getItem('lastCoinBalance');
          const updatedAt = localStorage.getItem('coinBalanceUpdatedAt');
          
          if (lastCoinBalance && updatedAt) {
            const updateTime = parseInt(updatedAt);
            const now = Date.now();
            
            // Only use if recent (within 5 minutes)
            if ((now - updateTime) < 300000) {
              const coins = parseInt(lastCoinBalance);
              console.log('Using recent coin balance from localStorage:', coins);
              setCurrentUserCoins(coins);
              
              // Update session
              if (session?.user) {
                await updateSession({
                  ...session,
                  user: {
                    ...session.user,
                    coins: coins
                  }
                });
              }
              setLoading(false);
              return;
            }
          }
        } catch (localErr) {
          console.error('Error checking localStorage:', localErr);
        }
        
        // If we reached here, all methods failed
        toast.error('Failed to fetch your coin balance');
        setCurrentUserCoins(session?.user?.coins || 0);
        setLoading(false);
        return;
      }
      
      console.log('Fetched user data from Supabase:', data);
      setCurrentUserCoins(data.coins || 0);
      
      // Update session
      if (session?.user) {
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
      console.error('Error fetching current user:', err);
      toast.error('Failed to fetch your coin balance');
      
      // Use session data as a last resort
      setCurrentUserCoins(session?.user?.coins || 0);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdmins = async () => {
    try {
      setLoadingAdmins(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', UserRole.ADMIN)
        .order('name');
      
      if (error) throw new Error(error.message);
      
      setAdmins(data || []);
    } catch (err) {
      console.error('Error fetching admins:', err);
      setError(err instanceof Error ? err.message : 'Failed to load admins');
    } finally {
      setLoadingAdmins(false);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoadingTransactions(true);
      console.log('Fetching transactions from Supabase...');
      
      // Attempt to query transactions without specifying an order
      const { data: transactionData, error: transactionError } = await supabase
        .from('coin_transactions')
        .select('*')
        .limit(20);
      
      console.log('Transaction query response:', { data: transactionData, error: transactionError });
      
      if (transactionError) {
        console.error('Error fetching transactions:', transactionError);
        setTransactions([]);
        setLoadingTransactions(false);
        return;
      }
      
      if (!transactionData || transactionData.length === 0) {
        console.log('No transactions found in the database');
        setTransactions([]);
        setLoadingTransactions(false);
        return;
      }
      
      console.log(`Found ${transactionData.length} transactions:`, transactionData);
      
      // Collect all user IDs from transactions (handle both naming conventions)
      const userIds = new Set<string>();
      transactionData.forEach(transaction => {
        // Support both naming conventions
        const fromUserId = transaction.from_user_id || transaction.fromUserId;
        const toUserId = transaction.to_user_id || transaction.toUserId;
        
        if (fromUserId) userIds.add(fromUserId);
        if (toUserId) userIds.add(toUserId);
      });
      
      console.log('Collecting user details for IDs:', Array.from(userIds));
      
      // Fetch user details for all IDs
      const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id, name, email, role')
        .in('id', Array.from(userIds));
      
      if (usersError) {
        console.error('Error fetching user details for transactions:', usersError);
      }
      
      // Create a map of user id to user details
      const userMap = new Map();
      if (usersData) {
        usersData.forEach(user => {
          userMap.set(user.id, user);
        });
      }
      
      // Combine transaction data with user details
      const enrichedTransactions = transactionData.map(transaction => {
        // Support both naming conventions
        const fromUserId = transaction.from_user_id || transaction.fromUserId;
        const toUserId = transaction.to_user_id || transaction.toUserId;
        const createdAt = transaction.created_at || transaction.createdAt;
        
        const fromUser = fromUserId ? userMap.get(fromUserId) : null;
        const toUser = toUserId ? userMap.get(toUserId) : null;
        
        return {
          ...transaction,
          // Ensure we have both snake_case and camelCase fields for compatibility
          from_user_id: fromUserId,
          to_user_id: toUserId,
          fromUser,
          toUser,
          // Add a standardized created_at field
          created_at: createdAt
        };
      });
      
      console.log('Enriched transactions with user details:', enrichedTransactions);
      setTransactions(enrichedTransactions);
    } catch (err) {
      console.error('Exception in fetchTransactions:', err);
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleTransferSubmit = async (values: any, { resetForm, setSubmitting }: any) => {
    try {
      setTransactionError(null);
      
      if (!session?.user?.id) {
        throw new Error('User session not found');
      }
      
      const isTakingCoins = values.operation === 'take';
      
      // Prepare the payload
      const transactionData = {
        amount: values.amount,
        from_user_id: isTakingCoins ? values.adminId : session.user.id,
        to_user_id: isTakingCoins ? session.user.id : values.adminId,
        notes: values.notes || undefined
      };

      // Check if the admin has enough coins when taking coins
      if (isTakingCoins) {
        const admin = admins.find(a => a.id === values.adminId);
        if (!admin) {
          throw new Error('Admin not found');
        }
        
        if (admin.coins < values.amount) {
          throw new Error(`Admin only has ${admin.coins} coins, which is insufficient for this transaction`);
        }
      }
      
      // For giving coins, check if SuperAdmin has enough
      if (!isTakingCoins && currentUserCoins < values.amount) {
        throw new Error(`You only have ${currentUserCoins} coins, which is insufficient for this transaction`);
      }
      
      const response = await fetch('/api/coins/transfer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process coin transfer');
      }
      
      toast.success(`Successfully ${isTakingCoins ? 'taken' : 'given'} ${values.amount} coins ${isTakingCoins ? 'from' : 'to'} admin`);
      resetForm();
      
      // Refresh data
      fetchAdmins();
      fetchTransactions();
      fetchCurrentUser();
    } catch (err) {
      console.error('Error processing coin transfer:', err);
      setTransactionError(err instanceof Error ? err.message : 'Failed to process coin transfer');
      toast.error(err instanceof Error ? err.message : 'Failed to process coin transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (error) {
      return dateString;
    }
  };

  // Helper function to determine transaction type
  const getTransactionType = (transaction: Transaction) => {
    // Support both naming conventions
    const fromUserId = transaction.from_user_id || transaction.fromUserId;
    const toUserId = transaction.to_user_id || transaction.toUserId;
    
    // System transaction (same from/to)
    if (fromUserId === toUserId) {
      return { type: "System", color: "info" as const };
    } 
    // Admin creation
    else if (transaction.notes && transaction.notes.toLowerCase().includes('initial coin allocation')) {
      return { type: "Admin Creation", color: "secondary" as const };
    }
    // Bonus allocation
    else if (transaction.notes && transaction.notes.toLowerCase().includes('bonus')) {
      return { type: "Bonus", color: "success" as const };
    }
    // Reclaiming coins
    else if (transaction.notes && transaction.notes.toLowerCase().includes('reclaim')) {
      return { type: "Reclaim", color: "warning" as const };
    }
    // Large allocation
    else if (transaction.amount >= 50000) {
      return { type: "Allocation", color: "primary" as const };
    }
    // Default
    return { type: "Transfer", color: "default" as const };
  };

  if (!session?.user) {
    return <Alert severity="error">Authentication required</Alert>;
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 'medium' }}>
          Coin Management
        </Typography>
      </Box>

      {/* Current Coins Display */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Your Coin Balance
              </Typography>
              {loading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                  <CircularProgress size={20} sx={{ mr: 1 }} />
                  <Typography variant="body1" color="text.secondary">
                    Loading balance...
                  </Typography>
                </Box>
              ) : (
                <>
                  <Typography variant="h4" sx={{ color: 'warning.main', fontWeight: 'bold' }}>
                    {currentUserCoins.toLocaleString()} Coins
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Available for distribution
                  </Typography>
                </>
              )}
            </Box>
            <Box
              sx={{
                backgroundColor: 'warning.light',
                borderRadius: '50%',
                width: 56,
                height: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Coins color="#ed6c02" size={28} />
            </Box>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4 }}>
        {/* Coin Transfer Form */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Transfer Coins
          </Typography>
          
          <Card>
            <CardContent>
              <Formik
                initialValues={{
                  adminId: '',
                  amount: '',
                  operation: 'give',
                  reason: '',
                  notes: ''
                }}
                validationSchema={transactionSchema}
                onSubmit={handleTransferSubmit}
              >
                {({ isSubmitting, values, errors, touched, setFieldValue }) => (
                  <Form>
                    <Stack spacing={3}>
                      <FormControl fullWidth error={touched.adminId && Boolean(errors.adminId)}>
                        <InputLabel id="admin-select-label">Select Admin</InputLabel>
                        <Field
                          as={Select}
                          name="adminId"
                          labelId="admin-select-label"
                          label="Select Admin"
                        >
                          {loadingAdmins ? (
                            <MenuItem disabled>Loading admins...</MenuItem>
                          ) : admins.length === 0 ? (
                            <MenuItem disabled>No admins found</MenuItem>
                          ) : (
                            admins.map((admin) => (
                              <MenuItem key={admin.id} value={admin.id}>
                                {admin.name} ({admin.coins} coins)
                              </MenuItem>
                            ))
                          )}
                        </Field>
                        <ErrorMessage name="adminId" component="div" className="error-message" />
                      </FormControl>

                      <FormControl fullWidth error={touched.operation && Boolean(errors.operation)}>
                        <InputLabel id="operation-select-label">Operation</InputLabel>
                        <Field
                          as={Select}
                          name="operation"
                          labelId="operation-select-label"
                          label="Operation"
                        >
                          <MenuItem value="give">Give Coins</MenuItem>
                          <MenuItem value="take">Take Coins</MenuItem>
                        </Field>
                        <ErrorMessage name="operation" component="div" className="error-message" />
                      </FormControl>

                      <FormControl fullWidth error={touched.amount && Boolean(errors.amount)}>
                        <Field
                          as={TextField}
                          name="amount"
                          label="Amount"
                          type="number"
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Coins size={16} />
                              </InputAdornment>
                            ),
                          }}
                        />
                        <ErrorMessage name="amount" component="div" className="error-message" />
                      </FormControl>

                      <FormControl fullWidth error={touched.reason && Boolean(errors.reason)}>
                        <InputLabel id="reason-select-label">Reason</InputLabel>
                        <Field
                          as={Select}
                          name="reason"
                          labelId="reason-select-label"
                          label="Reason"
                        >
                          <MenuItem value="ALLOCATION">Allocation</MenuItem>
                          <MenuItem value="ADJUSTMENT">Balance Adjustment</MenuItem>
                          <MenuItem value="BONUS">Bonus</MenuItem>
                          <MenuItem value="CORRECTION">Correction</MenuItem>
                        </Field>
                        <ErrorMessage name="reason" component="div" className="error-message" />
                      </FormControl>

                      <Field
                        as={TextField}
                        name="notes"
                        label="Notes (Optional)"
                        multiline
                        rows={3}
                      />

                      {transactionError && (
                        <Alert severity="error">{transactionError}</Alert>
                      )}

                      <Button
                        type="submit"
                        variant="contained"
                        color={values.operation === 'give' ? 'primary' : 'warning'}
                        disabled={isSubmitting || loadingAdmins}
                        startIcon={values.operation === 'give' ? <Plus size={16} /> : <Minus size={16} />}
                      >
                        {isSubmitting ? (
                          <>
                            <CircularProgress size={16} sx={{ mr: 1 }} color="inherit" />
                            Processing...
                          </>
                        ) : (
                          values.operation === 'give' ? 'Give Coins' : 'Take Coins'
                        )}
                      </Button>
                    </Stack>
                  </Form>
                )}
              </Formik>
            </CardContent>
          </Card>
        </Box>
        
        {/* Recent Transactions */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Recent Transactions
          </Typography>
          
          {loadingTransactions ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : transactions.length === 0 ? (
            <Alert severity="info">
              No transactions found
            </Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Type</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((transaction) => {
                    // Use the helper function to determine transaction type
                    const { type: transactionType, color: chipColor } = getTransactionType(transaction);
                    
                    // Determine if the transaction is incoming or outgoing relative to the current user
                    const isReceived = transaction.to_user_id === session?.user?.id;
                    const isOutgoing = transaction.from_user_id === session?.user?.id;
                    
                    // Get the other party in the transaction
                    const otherPartyUser = isReceived ? transaction.fromUser : transaction.toUser;
                    const otherParty = otherPartyUser ? otherPartyUser.name || otherPartyUser.email : 'Unknown';
                    
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <Chip 
                            label={transactionType} 
                            size="small" 
                            color={chipColor}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {isReceived ? `From: ${otherParty}` : 
                             isOutgoing ? `To: ${otherParty}` : 
                             transactionType === "System" ? "System Adjustment" : otherParty}
                          </Typography>
                          {transaction.notes && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              {transaction.notes}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography 
                            variant="body2" 
                            fontWeight="bold" 
                            color={isReceived ? 'success.main' : isOutgoing ? 'error.main' : 'text.primary'}
                          >
                            {isReceived ? '+' : isOutgoing ? '-' : ''}{transaction.amount}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Calendar size={14} style={{ marginRight: '4px' }} />
                            <Typography variant="body2">
                              {formatDate(transaction.created_at)}
                            </Typography>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Box>
    </Box>
  );
} 
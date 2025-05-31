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
  from_user_id: string;
  to_user_id: string;
  reason: string;
  notes?: string;
  created_at: string;
  updated_at: string;
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
  transactionType?: string;
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
      
      // Just get all transactions and handle the filtering in the UI
      const { data: transactionData, error: transactionError } = await supabase
        .from('coin_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (transactionError) {
        console.error('Error fetching transactions:', transactionError);
        setTransactions([]);
        setLoadingTransactions(false);
        return;
      }
      
      if (!transactionData || transactionData.length === 0) {
        console.log('No transactions found in the system');
        setTransactions([]);
        setLoadingTransactions(false);
        return;
      }
      
      console.log('Found transactions:', transactionData.length);
      await processTransactions(transactionData);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };
  
  // Helper function to process transaction data
  const processTransactions = async (transactionData: any[]) => {
    try {
      // Collect all user IDs from transactions
      const userIds = new Set<string>();
      transactionData.forEach(transaction => {
        if (transaction.from_user_id) userIds.add(transaction.from_user_id);
        if (transaction.to_user_id) userIds.add(transaction.to_user_id);
      });
      
      // Fetch user details separately
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
      const enrichedTransactions = transactionData.map(transaction => ({
        ...transaction,
        fromUser: transaction.from_user_id ? userMap.get(transaction.from_user_id) : null,
        toUser: transaction.to_user_id ? userMap.get(transaction.to_user_id) : null,
        // Add a derived transaction type based on pattern matching
        transactionType: getTransactionTypeFromData(transaction)
      }));
      
      setTransactions(enrichedTransactions);
    } catch (err) {
      console.error('Error processing transactions:', err);
      setTransactions([]);
    }
  };

  // Helper function to determine transaction type based on transaction data patterns
  const getTransactionTypeFromData = (transaction: any): string => {
    // Check for system transactions (self-transactions with same user ID)
    if (transaction.from_user_id === transaction.to_user_id) {
      return 'SYSTEM';
    }
    
    // Check for pattern of admin creation (from SuperAdmin to an Admin)
    if (transaction.from_user_id === session?.user?.id && 
        transaction.to_user_id && 
        transaction.notes && 
        transaction.notes.toLowerCase().includes('admin')) {
      return 'ADMIN_CREATION';
    }
    
    // Default transaction types based on the amount
    if (transaction.amount >= 50000) {
      return 'ALLOCATION';
    }
    
    return 'TRANSFER';
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
        reason: values.reason,
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

  const getTransactionDescription = (transaction: Transaction): string => {
    // Special handling for system transactions
    if (transaction.from_user_id === transaction.to_user_id) {
      return 'System Balance Adjustment';
    }
    
    // Check if it looks like an admin creation (from SuperAdmin to Admin with significant amount)
    if (transaction.from_user_id === session?.user?.id && 
        transaction.toUser?.role === 'ADMIN' && 
        transaction.amount >= 10000) {
      return `Admin Creation: ${transaction.toUser?.name || 'Unknown Admin'}`;
    }
    
    const isReceived = transaction.to_user_id === session?.user?.id;
    const otherParty = isReceived ? transaction.fromUser : transaction.toUser;
    
    return `${isReceived ? 'Received from' : 'Sent to'} ${otherParty?.name || 'Unknown'}`;
  };

  const getTransactionAmount = (transaction: Transaction): string => {
    // For system transactions, just show the amount
    if (transaction.from_user_id === transaction.to_user_id) {
      return `${transaction.amount}`;
    }
    
    // For admin creation, just show the amount
    if (transaction.from_user_id === session?.user?.id && 
        transaction.toUser?.role === 'ADMIN' && 
        transaction.amount >= 10000) {
      return `${transaction.amount}`;
    }
    
    const isReceived = transaction.to_user_id === session?.user?.id;
    return `${isReceived ? '+' : '-'}${transaction.amount}`;
  };

  const getTransactionColor = (transaction: Transaction): string => {
    // For system transactions, use a neutral color
    if (transaction.from_user_id === transaction.to_user_id) {
      return 'info.main';
    }
    
    // For admin creation, use a distinct color
    if (transaction.from_user_id === session?.user?.id && 
        transaction.toUser?.role === 'ADMIN' && 
        transaction.amount >= 10000) {
      return 'secondary.main';
    }
    
    const isReceived = transaction.to_user_id === session?.user?.id;
    return isReceived ? 'success.main' : 'error.main';
  };

  // Helper function to get a more descriptive reason text
  const getTransactionReasonText = (transaction: Transaction): string => {
    // For system transactions (self transactions)
    if (transaction.from_user_id === transaction.to_user_id) {
      return 'System Adjustment';
    }
    
    // For admin creation (from SuperAdmin to Admin with large amount)
    if (transaction.from_user_id === session?.user?.id && 
        transaction.toUser?.role === 'ADMIN' && 
        transaction.amount >= 10000) {
      return 'Admin Creation';
    }
    
    // For large amounts (allocation)
    if (transaction.amount >= 50000) {
      return 'Coin Allocation';
    }
    
    // Check notes for hints
    if (transaction.notes) {
      const notesLower = transaction.notes.toLowerCase();
      if (notesLower.includes('bonus')) return 'Bonus Coins';
      if (notesLower.includes('correction')) return 'Correction';
      if (notesLower.includes('adjustment')) return 'Balance Adjustment';
    }
    
    return 'Coin Transfer';
  };

  // Helper function to get chip color based on transaction type
  const getChipColor = (transaction: Transaction): "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning" => {
    // For system transactions (self transactions)
    if (transaction.from_user_id === transaction.to_user_id) {
      return 'info';
    }
    
    // For admin creation (from SuperAdmin to Admin with large amount)
    if (transaction.from_user_id === session?.user?.id && 
        transaction.toUser?.role === 'ADMIN' && 
        transaction.amount >= 10000) {
      return 'secondary';
    }
    
    // For large amounts (allocation)
    if (transaction.amount >= 50000) {
      return 'primary';
    }
    
    // Check notes for hints
    if (transaction.notes) {
      const notesLower = transaction.notes.toLowerCase();
      if (notesLower.includes('bonus')) return 'success';
      if (notesLower.includes('correction')) return 'error';
      if (notesLower.includes('adjustment')) return 'warning';
    }
    
    return 'default';
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
                    <TableCell>Transaction</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {getTransactionDescription(transaction)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {transaction.toUser?.email || transaction.fromUser?.email || 'Unknown'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          fontWeight="bold" 
                          color={getTransactionColor(transaction)}
                        >
                          {getTransactionAmount(transaction)}
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
                      <TableCell>
                        <Chip 
                          label={getTransactionReasonText(transaction)} 
                          size="small" 
                          color={getChipColor(transaction)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      </Box>
    </Box>
  );
} 
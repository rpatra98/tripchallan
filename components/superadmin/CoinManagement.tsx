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
  };
  toUser?: {
    name: string;
    email: string;
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
      const { data, error } = await supabase
        .from('users')
        .select('coins')
        .eq('id', session.user.id)
        .single();
      
      if (error) throw error;
      
      setCurrentUserCoins(data.coins || 0);
      
      // Update session
      if (session?.user) {
        await updateSession({
          ...session,
          user: {
            ...session.user,
            coins: data.coins
          }
        });
      }
    } catch (err) {
      console.error('Error fetching current user:', err);
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
      
      const { data, error } = await supabase
        .from('coin_transactions')
        .select(`
          *,
          fromUser:users!coin_transactions_from_user_id_fkey(id, name, email),
          toUser:users!coin_transactions_to_user_id_fkey(id, name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw new Error(error.message);
      
      setTransactions(data || []);
    } catch (err) {
      console.error('Error fetching transactions:', err);
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
    const isReceived = transaction.to_user_id === session?.user?.id;
    const otherParty = isReceived ? transaction.fromUser : transaction.toUser;
    
    return `${isReceived ? 'Received from' : 'Sent to'} ${otherParty?.name || 'Unknown'}`;
  };

  const getTransactionAmount = (transaction: Transaction): string => {
    const isReceived = transaction.to_user_id === session?.user?.id;
    return `${isReceived ? '+' : '-'}${transaction.amount}`;
  };

  const getTransactionColor = (transaction: Transaction): string => {
    const isReceived = transaction.to_user_id === session?.user?.id;
    return isReceived ? 'success.main' : 'error.main';
  };

  if (!session?.user) {
    return <Alert severity="error">Authentication required</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 'medium' }}>
          Coin Management
        </Typography>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button 
            variant="outlined" 
            startIcon={<RefreshCcw size={16} />} 
            onClick={() => {
              fetchAdmins();
              fetchTransactions();
              fetchCurrentUser();
            }}
            disabled={loading}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Current Coins Display */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
              <Typography variant="body2" color="text.secondary">
                Your Coin Balance
              </Typography>
              <Typography variant="h4" sx={{ color: 'warning.main', fontWeight: 'bold' }}>
                {currentUserCoins.toLocaleString()} Coins
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Available for distribution
              </Typography>
            </Box>
            <Box
              sx={{
                backgroundColor: 'warning.light',
                borderRadius: '50%',
                width: 56,
                height: 56,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
                          label={transaction.reason} 
                          size="small" 
                          color="default"
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
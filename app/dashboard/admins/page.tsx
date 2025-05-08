"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Card,
  CardContent,
  CardHeader,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Box,
  Alert,
  IconButton
} from "@mui/material";
import { ArrowLeft, Plus, Trash2, Eye } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { UserRole } from "@/prisma/enums";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  coins: number;
  createdAt: string;
  hasCreatedResources: boolean;
}

export default function AdminsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    // Redirect if not logged in or not a superadmin
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.push('/login');
      return;
    }
    
    if (session.user.role !== UserRole.SUPERADMIN) {
      router.push('/dashboard');
      return;
    }
    
    fetchAdmins();
  }, [status, session, router]);
  
  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admins', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch admins');
      }
      
      const data = await response.json();
      setAdmins(data.admins || []);
    } catch (err) {
      console.error('Error fetching admins:', err);
      setError('Failed to load admins. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy");
  };

  const handleViewDetails = (adminId: string) => {
    router.push(`/dashboard/admins/${adminId}`);
  };

  const handleAddAdmin = () => {
    router.push('/dashboard/admins/create');
  };

  const handleDeleteAdmin = async (adminId: string) => {
    setDeleteLoading(true);
    setDeleteError(null);
    
    try {
      console.log(`Attempting to delete admin with ID: ${adminId}`);
      
      const response = await fetch(`/api/admins/${adminId}`, {
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
            `Please reassign or delete their companies and employees first.`
          );
        }
        throw new Error(data.error || 'Failed to delete admin');
      }

      toast.success('Admin deleted successfully');
      // Update the UI by removing the deleted admin
      setAdmins(admins.filter((admin) => admin.id !== adminId));
      // Close the dialog after successful deletion
      setDeleteConfirmOpen(false);
      setAdminToDelete(null);
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

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Box p={2} color="error.main">{error}</Box>;
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <Typography variant="h5" component="h1" fontWeight="bold">
          Admin Users
        </Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<Plus size={16} />}
          onClick={handleAddAdmin}
        >
          Add Admin
        </Button>
      </div>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Coins</TableCell>
              <TableCell>Created On</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {admins.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No admin users found
                </TableCell>
              </TableRow>
            ) : (
              admins.map((admin) => (
                <TableRow key={admin.id}>
                  <TableCell>{admin.name}</TableCell>
                  <TableCell>{admin.email}</TableCell>
                  <TableCell>{admin.coins.toLocaleString()}</TableCell>
                  <TableCell>{formatDate(admin.createdAt)}</TableCell>
                  <TableCell>
                    <Chip 
                      label={admin.hasCreatedResources ? "Has Resources" : "No Resources"} 
                      color={admin.hasCreatedResources ? "warning" : "success"}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton 
                      size="small"
                      onClick={() => handleViewDetails(admin.id)}
                      title="View Details"
                    >
                      <Eye size={18} />
                    </IconButton>
                    <IconButton 
                      size="small"
                      onClick={() => {
                        setDeleteConfirmOpen(true);
                        setAdminToDelete(admin.id);
                      }}
                      title="Delete Admin"
                    >
                      <Trash2 size={18} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog
        open={deleteConfirmOpen}
        onClose={() => {
          if (!deleteLoading) {
            setDeleteConfirmOpen(false);
            setAdminToDelete(null);
            setDeleteError(null);
          }
        }}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">{"Confirm Deletion"}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to delete this admin? This action cannot be undone.
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
              setDeleteConfirmOpen(false);
              setAdminToDelete(null);
              setDeleteError(null);
            }} 
            color="primary"
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={() => {
              if (adminToDelete) {
                handleDeleteAdmin(adminToDelete);
              }
            }} 
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
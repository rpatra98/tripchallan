"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { 
  Box, 
  Button, 
  Card, 
  CardContent, 
  Typography, 
  CircularProgress, 
  Alert, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogContentText, 
  DialogActions,
  Chip,
  Grid as MuiGrid
} from "@mui/material";
import { UserRole } from "@/lib/enums";
import { supabase } from "@/lib/supabase";
import { Edit, Trash2, AlertTriangle, UserCheck, UserX } from "lucide-react";
import { toast } from "react-hot-toast";

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  active?: boolean;
  createdAt: string;
  coins?: number;
}

export default function AdminManagement() {
  const router = useRouter();
  const { data: session } = useSession();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<string | null>(null);
  const [adminToDeleteName, setAdminToDeleteName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activateDeactivateLoading, setActivateDeactivateLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchAdmins();
  }, []);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('role', 'ADMIN')
        .order('createdAt', { ascending: false });
      
      if (error) {
        throw new Error(error.message);
      }
      
      setAdmins(data || []);
    } catch (err) {
      console.error('Error fetching admins:', err);
      setError(err instanceof Error ? err.message : 'Failed to load admins');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (admin: AdminUser) => {
    setAdminToDelete(admin.id);
    setAdminToDeleteName(admin.name);
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setAdminToDelete(null);
    setAdminToDeleteName("");
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!adminToDelete) return;
    
    try {
      setDeleteLoading(true);
      setDeleteError(null);
      
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', adminToDelete);
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Update the local state by removing the deleted admin
      setAdmins(admins.filter(admin => admin.id !== adminToDelete));
      toast.success(`Admin ${adminToDeleteName} was deleted successfully`);
      
      // Close the dialog
      setDeleteDialogOpen(false);
      setAdminToDelete(null);
      setAdminToDeleteName("");
    } catch (err) {
      console.error('Error deleting admin:', err);
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete admin');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleActivateDeactivate = async (adminId: string, currentStatus: boolean) => {
    try {
      setActivateDeactivateLoading(adminId);
      
      const { error } = await supabase
        .from('users')
        .update({ active: !currentStatus })
        .eq('id', adminId);
      
      if (error) {
        throw new Error(error.message);
      }
      
      // Update the local state
      setAdmins(admins.map(admin => 
        admin.id === adminId ? { ...admin, active: !currentStatus } : admin
      ));
      
      toast.success(`Admin ${currentStatus ? 'deactivated' : 'activated'} successfully`);
    } catch (err) {
      console.error('Error updating admin status:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update admin status');
    } finally {
      setActivateDeactivateLoading(null);
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

  if (!session?.user) {
    return <Alert severity="error">Authentication required</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 'medium' }}>
          Admin Management
        </Typography>
        
        <Link href="/dashboard/admins/create" passHref>
          <Button 
            variant="contained" 
            color="primary"
          >
            Create New Admin
          </Button>
        </Link>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={fetchAdmins}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : admins.length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          No admin users found. Create your first admin using the button above.
        </Alert>
      ) : (
        <MuiGrid container spacing={3}>
          {admins.map((admin) => (
            <MuiGrid item xs={12} sm={6} md={4} key={admin.id}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" sx={{ fontWeight: 'medium', mb: 0.5 }}>
                      {admin.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {admin.email}
                    </Typography>
                    
                    <Chip 
                      label={admin.active === false ? "Inactive" : "Active"} 
                      color={admin.active === false ? "error" : "success"}
                      size="small"
                      sx={{ mr: 1 }}
                    />
                    
                    <Chip 
                      label="Admin" 
                      color="primary"
                      size="small"
                    />
                  </Box>
                  
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    <strong>Created:</strong> {formatDate(admin.createdAt)}
                  </Typography>
                  
                  {admin.coins !== undefined && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      <strong>Coins:</strong> {admin.coins.toLocaleString()}
                    </Typography>
                  )}
                  
                  <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Edit size={16} />}
                      onClick={() => router.push(`/dashboard/admins/${admin.id}`)}
                    >
                      Details
                    </Button>
                    
                    <Button
                      variant="outlined"
                      size="small"
                      color={admin.active === false ? "success" : "warning"}
                      startIcon={admin.active === false ? <UserCheck size={16} /> : <UserX size={16} />}
                      onClick={() => handleActivateDeactivate(admin.id, admin.active !== false)}
                      disabled={activateDeactivateLoading === admin.id}
                    >
                      {activateDeactivateLoading === admin.id
                        ? "Processing..."
                        : admin.active === false 
                          ? "Activate" 
                          : "Deactivate"}
                    </Button>
                    
                    <Button
                      variant="outlined"
                      size="small"
                      color="error"
                      startIcon={<Trash2 size={16} />}
                      onClick={() => handleDeleteClick(admin)}
                    >
                      Delete
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </MuiGrid>
          ))}
        </MuiGrid>
      )}
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={deleteLoading ? undefined : handleDeleteCancel}
      >
        <DialogTitle>Delete Admin User</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Are you sure you want to delete the admin user <strong>{adminToDeleteName}</strong>?
            This action cannot be undone.
          </DialogContentText>
          
          <Box sx={{ display: 'flex', alignItems: 'center', color: 'warning.main', mb: 1 }}>
            <AlertTriangle size={20} style={{ marginRight: '8px' }} />
            <Typography variant="body2" color="warning.main">
              All data associated with this admin will be permanently removed.
            </Typography>
          </Box>
          
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleDeleteCancel} 
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleDeleteConfirm} 
            color="error" 
            disabled={deleteLoading}
            variant="contained"
          >
            {deleteLoading ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
} 
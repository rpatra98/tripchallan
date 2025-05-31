"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { 
  Paper, 
  Typography, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  Button,
  Box,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle
} from "@mui/material";
import { Add, Person, Search, Delete } from "@mui/icons-material";
import { UserRole } from "@/lib/enums";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  subrole?: string;
  coins: number;
  createdAt: string;
}

type SearchColumn = 'name' | 'email' | 'role' | 'coins' | 'created' | 'all';

export default function EmployeesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchColumn, setSearchColumn] = useState<SearchColumn>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch if we have a valid session
    if (session?.user) {
      fetchEmployees();
    }
  }, [session]);

  useEffect(() => {
    // Filter employees based on search query and selected column
    if (searchQuery.trim() === "") {
      setFilteredEmployees(employees);
    } else {
      const query = searchQuery.toLowerCase();
      
      const filtered = employees.filter((employee) => {
        if (searchColumn === 'all') {
          return (
            employee.name.toLowerCase().includes(query) ||
            employee.email.toLowerCase().includes(query) ||
            (employee.subrole || employee.role).toLowerCase().includes(query) ||
            employee.coins.toString().includes(query) ||
            new Date(employee.createdAt).toLocaleDateString().toLowerCase().includes(query)
          );
        } else if (searchColumn === 'name') {
          return employee.name.toLowerCase().includes(query);
        } else if (searchColumn === 'email') {
          return employee.email.toLowerCase().includes(query);
        } else if (searchColumn === 'role') {
          return (employee.subrole || employee.role).toLowerCase().includes(query);
        } else if (searchColumn === 'coins') {
          return employee.coins.toString().includes(query);
        } else if (searchColumn === 'created') {
          return new Date(employee.createdAt).toLocaleDateString().toLowerCase().includes(query);
        }
        return false;
      });
      
      setFilteredEmployees(filtered);
    }
  }, [searchQuery, searchColumn, employees]);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      let url = '/api/employees';
      
      // If user is a company, get employees for this company
      if (session?.user?.role === UserRole.COMPANY) {
        url = `/api/companies/${session.user.id}/employees`;
      }
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error("Failed to fetch employees");
      }
      
      const data = await response.json();
      setEmployees(data);
      setFilteredEmployees(data);
      setError("");
    } catch (err) {
      console.error("Error fetching employees:", err);
      setError("Failed to load employees. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateEmployee = () => {
    router.push("/dashboard/employees/create");
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
  };

  const handleColumnChange = (event: any) => {
    setSearchColumn(event.target.value as SearchColumn);
  };

  const handleDeleteClick = (employee: Employee) => {
    setEmployeeToDelete(employee);
    setDeleteDialogOpen(true);
    setDeleteError(null);
  };
  
  const handleCloseDeleteDialog = () => {
    if (!deleteLoading) {
      setDeleteDialogOpen(false);
      setEmployeeToDelete(null);
      setDeleteError(null);
    }
  };
  
  const confirmDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    
    setDeleteLoading(true);
    
    try {
      const response = await fetch(`/api/employees/${employeeToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete employee');
      }
      
      // Success - update UI
      setEmployees(employees.filter(emp => emp.id !== employeeToDelete.id));
      setDeleteDialogOpen(false);
      setEmployeeToDelete(null);
      
      // Show success message
      alert('Employee deleted successfully');
    } catch (error) {
      console.error('Error deleting employee:', error);
      setDeleteError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!session) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Employees
        </Typography>
        {session.user?.role === UserRole.ADMIN && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<Add />}
            onClick={handleCreateEmployee}
          >
            Add Employee
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" mt={4}>
          <CircularProgress />
        </Box>
      ) : employees.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <Typography variant="body1">
            No employees found.
          </Typography>
        </Paper>
      ) : (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} mb={3}>
            <FormControl sx={{ minWidth: 180 }}>
              <InputLabel id="search-column-label">Search In</InputLabel>
              <Select
                labelId="search-column-label"
                value={searchColumn}
                label="Search In"
                onChange={handleColumnChange}
              >
                <MenuItem value="all">All Columns</MenuItem>
                <MenuItem value="name">Name</MenuItem>
                <MenuItem value="email">Email</MenuItem>
                <MenuItem value="role">Role</MenuItem>
                <MenuItem value="coins">Coins</MenuItem>
                <MenuItem value="created">Created Date</MenuItem>
              </Select>
            </FormControl>
            
            <TextField
              fullWidth
              variant="outlined"
              placeholder={searchColumn === 'coins' ? "Enter number of coins..." : 
                           searchColumn === 'created' ? "Enter date (e.g., 1/1/2023)..." : 
                           "Enter search term..."}
              value={searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
          
          {filteredEmployees.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body1">
                No employees match your search criteria.
              </Typography>
            </Paper>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Coins</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id} hover>
                      <TableCell>{employee.name}</TableCell>
                      <TableCell>{employee.email}</TableCell>
                      <TableCell>{employee.subrole || employee.role}</TableCell>
                      <TableCell>{employee.coins}</TableCell>
                      <TableCell>
                        {new Date(employee.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <a 
                            href={`/dashboard/employees/${employee.id}`}
                            style={{ textDecoration: 'none' }}
                          >
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<Person />}
                            >
                              View Details
                            </Button>
                          </a>
                          {session.user?.role === UserRole.ADMIN && (
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              startIcon={<Delete />}
                              onClick={() => handleDeleteClick(employee)}
                            >
                              Delete
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
      >
        <DialogTitle>Confirm Employee Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete employee {employeeToDelete?.name}? This action cannot be undone.
          </DialogContentText>
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteError}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={handleCloseDeleteDialog} 
            disabled={deleteLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={confirmDeleteEmployee} 
            color="error" 
            disabled={deleteLoading}
            variant="contained"
          >
            {deleteLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
} 
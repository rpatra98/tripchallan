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
  Stack
} from "@mui/material";
import { Add, Person, Search } from "@mui/icons-material";
import { UserRole } from "@/prisma/enums";

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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </div>
  );
} 
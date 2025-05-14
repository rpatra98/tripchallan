"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
  Alert
} from "@mui/material";
import { Person, ArrowBack } from "@mui/icons-material";
import Link from "next/link";

interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  subrole?: string;
  coins: number;
  createdAt: string;
}

export default function CompanyEmployeesPage() {
  const params = useParams();
  const companyId = params.id as string;
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companyName, setCompanyName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCompanyDetails = async () => {
      try {
        const response = await fetch(`/api/companies/${companyId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch company details");
        }
        const data = await response.json();
        setCompanyName(data.name || "Company");
      } catch (err) {
        console.error("Error fetching company details:", err);
      }
    };

    const fetchEmployees = async () => {
      setLoading(true);
      try {
        console.log(`Fetching employees for company ${companyId}`);
        const response = await fetch(`/api/companies/${companyId}/employees`);
        
        if (!response.ok) {
          console.error("Failed to fetch employees:", response.status, response.statusText);
          throw new Error("Failed to fetch employees");
        }
        
        const data = await response.json();
        console.log(`Found ${data.length} employees for company ${companyId}`, data);
        setEmployees(data);
        setError("");
      } catch (err) {
        console.error("Error fetching employees:", err);
        setError("Failed to load employees. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchCompanyDetails();
    fetchEmployees();
  }, [companyId]);

  return (
    <div>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Link href="/dashboard?tab=employees" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', marginBottom: '16px', color: 'blue' }}>
            <ArrowBack sx={{ mr: 1, fontSize: '1rem' }} />
            Back to Dashboard
          </Link>
          <Typography variant="h4" component="h1">
            {companyName} Employees
          </Typography>
        </Box>
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
            No employees found for this company.
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
              {employees.map((employee) => (
                <TableRow key={employee.id} hover>
                  <TableCell>{employee.name}</TableCell>
                  <TableCell>{employee.email}</TableCell>
                  <TableCell>{employee.subrole || employee.role}</TableCell>
                  <TableCell>{employee.coins}</TableCell>
                  <TableCell>
                    {new Date(employee.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Person />}
                      onClick={(e) => {
                        e.preventDefault();
                        // Log for debugging
                        console.log("View employee details clicked:", {
                          employee_id: employee.id,
                          companyId,
                          url: `/dashboard/employees/${employee.id}?source=company&companyId=${companyId}`
                        });
                        // Use direct window navigation for maximum compatibility
                        window.location.href = `/dashboard/employees/${employee.id}?source=company&companyId=${companyId}`;
                      }}
                    >
                      View Details
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
} 
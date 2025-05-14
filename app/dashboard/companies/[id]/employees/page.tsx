"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
  Collapse,
  IconButton,
  Divider
} from "@mui/material";
import { Person, ArrowBack, KeyboardArrowUp, KeyboardArrowDown, Refresh } from "@mui/icons-material";
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

// Row component with expandable details
function EmployeeRow({ employee, companyId }: { employee: Employee, companyId: string }) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleToggleDetails = async () => {
    const newOpen = !open;
    setOpen(newOpen);

    // If we're opening and don't have details yet, fetch them
    if (newOpen && !details) {
      setLoading(true);
      try {
        const response = await fetch(`/api/employees/${employee.id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch employee details");
        }
        const data = await response.json();
        setDetails(data);
        setError("");
      } catch (err) {
        console.error("Error fetching employee details:", err);
        setError("Failed to load details");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <>
      <TableRow hover>
        <TableCell>
          <IconButton
            aria-label="expand row"
            size="small"
            onClick={handleToggleDetails}
          >
            {open ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
          </IconButton>
        </TableCell>
        <TableCell>{employee.name}</TableCell>
        <TableCell>{employee.email}</TableCell>
        <TableCell>{employee.subrole || employee.role}</TableCell>
        <TableCell>{employee.coins}</TableCell>
        <TableCell>
          {new Date(employee.createdAt).toLocaleDateString()}
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ margin: 2 }}>
              <Typography variant="h6" gutterBottom component="div">
                Employee Details
              </Typography>
              
              {loading ? (
                <Box display="flex" justifyContent="center" p={2}>
                  <CircularProgress size={24} />
                </Box>
              ) : error ? (
                <Alert severity="error">{error}</Alert>
              ) : details ? (
                <Box sx={{ mb: 2 }} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <Typography variant="body2" color="text.secondary">ID</Typography>
                    <Typography variant="body1">{details.id || employee.id}</Typography>
                  </div>
                  <div>
                    <Typography variant="body2" color="text.secondary">Role</Typography>
                    <Typography variant="body1">
                      {details.subrole || details.role || employee.subrole || employee.role}
                    </Typography>
                  </div>
                  <div>
                    <Typography variant="body2" color="text.secondary">Coins</Typography>
                    <Typography variant="body1">{details.coins || employee.coins}</Typography>
                  </div>
                  <div>
                    <Typography variant="body2" color="text.secondary">Created</Typography>
                    <Typography variant="body1">
                      {new Date(details.createdAt || employee.createdAt).toLocaleDateString()}
                    </Typography>
                  </div>
                  
                  {details.company && (
                    <div className="col-span-2 md:col-span-4">
                      <Typography variant="body2" color="text.secondary">Company</Typography>
                      <Typography variant="body1">{details.company.name}</Typography>
                    </div>
                  )}
                  
                  {details.operatorPermissions && (
                    <div className="col-span-2 md:col-span-4">
                      <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Operator Permissions</Typography>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                bgcolor: details.operatorPermissions.canCreate ? "success.main" : "error.main",
                                mr: 1
                              }}
                            />
                            <Typography variant="body2">
                              Create: {details.operatorPermissions.canCreate ? "Yes" : "No"}
                            </Typography>
                          </Box>
                        </div>
                        <div>
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                bgcolor: details.operatorPermissions.canModify ? "success.main" : "error.main",
                                mr: 1
                              }}
                            />
                            <Typography variant="body2">
                              Modify: {details.operatorPermissions.canModify ? "Yes" : "No"}
                            </Typography>
                          </Box>
                        </div>
                        <div>
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <Box
                              sx={{
                                width: 10,
                                height: 10,
                                borderRadius: "50%",
                                bgcolor: details.operatorPermissions.canDelete ? "success.main" : "error.main",
                                mr: 1
                              }}
                            />
                            <Typography variant="body2">
                              Delete: {details.operatorPermissions.canDelete ? "Yes" : "No"}
                            </Typography>
                          </Box>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="col-span-2 md:col-span-4 mt-3">
                    <Box display="flex" justifyContent="flex-end">
                      <Link 
                        href={`/dashboard/employees/${employee.id}?source=company&companyId=${companyId}`}
                        style={{ textDecoration: 'none' }}
                      >
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<Person />}
                        >
                          Full Profile
                        </Button>
                      </Link>
                    </Box>
                  </div>
                </Box>
              ) : (
                <Box display="flex" justifyContent="center" p={2}>
                  <Typography>Click to load details</Typography>
                </Box>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

export default function CompanyEmployeesPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companyName, setCompanyName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        <Button 
          startIcon={<Refresh />}
          variant="outlined"
          onClick={fetchEmployees}
        >
          Refresh
        </Button>
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
                <TableCell style={{ width: 50 }}></TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Coins</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {employees.map((employee) => (
                <EmployeeRow 
                  key={employee.id}
                  employee={employee}
                  companyId={companyId}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
} 
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  CircularProgress,
  Alert,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Chip
} from "@mui/material";
import { 
  Search,
  RefreshCcw,
  Eye,
  Calendar,
  Filter
} from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Trip {
  id: string;
  status: string;
  companyId: string;
  company?: {
    name: string;
    email: string;
  };
  createdById: string;
  createdBy?: {
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
  details?: any;
  departureLocation?: string;
  destinationLocation?: string;
  vehicleId?: string;
  vehicle?: {
    registrationNumber: string;
    type: string;
  };
}

export default function TripManagement() {
  const { data: session } = useSession();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalTrips, setTotalTrips] = useState(0);

  useEffect(() => {
    fetchTrips();
  }, [statusFilter, page, rowsPerPage]);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Build the query
      let query = supabase
        .from('sessions')
        .select(`
          *,
          company:companies(*),
          createdBy:users(*),
          vehicle:vehicles(*)
        `)
        .order('createdAt', { ascending: false })
        .range(page * rowsPerPage, (page + 1) * rowsPerPage - 1);
      
      // Apply status filter if not "all"
      if (statusFilter !== "all") {
        query = query.eq('status', statusFilter);
      }
      
      const { data, error, count } = await query;
      
      if (error) throw new Error(error.message);
      
      setTrips(data || []);
      setTotalTrips(count || 0);
    } catch (err) {
      console.error('Error fetching trips:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trips');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    // This would ideally search through the trips data
    // For simplicity, just filter locally for now
    // In a real app, you would implement a more robust search on the server
    fetchTrips();
  };

  const handleViewDetails = (tripId: string) => {
    router.push(`/dashboard/sessions/${tripId}`);
  };

  const handleStatusFilterChange = (event: any) => {
    setStatusFilter(event.target.value);
    setPage(0); // Reset to first page when filter changes
  };

  const handleChangePage = (newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    } catch (error) {
      return dateString;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'IN_PROGRESS':
        return 'info';
      case 'PENDING':
        return 'warning';
      case 'CANCELLED':
        return 'error';
      default:
        return 'default';
    }
  };

  if (!session?.user) {
    return <Alert severity="error">Authentication required</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" component="h2" sx={{ fontWeight: 'medium' }}>
          Trip Management
        </Typography>
        
        <Button 
          variant="outlined" 
          startIcon={<RefreshCcw size={16} />} 
          onClick={fetchTrips}
          disabled={loading}
        >
          Refresh
        </Button>
      </Box>

      {/* Search and Filter */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <TextField
            placeholder="Search trips..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={20} />
                </InputAdornment>
              ),
            }}
            sx={{ flexGrow: 1 }}
            size="small"
          />
          
          <FormControl sx={{ minWidth: 150 }} size="small">
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select
              labelId="status-filter-label"
              id="status-filter"
              value={statusFilter}
              label="Status"
              onChange={handleStatusFilterChange}
              startAdornment={
                <InputAdornment position="start">
                  <Filter size={18} />
                </InputAdornment>
              }
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="PENDING">Pending</MenuItem>
              <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
              <MenuItem value="COMPLETED">Completed</MenuItem>
              <MenuItem value="CANCELLED">Cancelled</MenuItem>
            </Select>
          </FormControl>
          
          <Button 
            variant="contained" 
            color="primary" 
            onClick={handleSearch}
            disabled={loading}
          >
            Search
          </Button>
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert 
          severity="error" 
          sx={{ mb: 3 }}
          action={
            <Button color="inherit" size="small" onClick={fetchTrips}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      ) : trips.length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          No trips found. {statusFilter !== "all" && "Try changing your filter criteria."}
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table sx={{ minWidth: 800 }}>
            <TableHead>
              <TableRow>
                <TableCell>ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Company</TableCell>
                <TableCell>Vehicle</TableCell>
                <TableCell>Created By</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Route</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trips.map((trip) => (
                <TableRow key={trip.id}>
                  <TableCell width={80}>{trip.id.substring(0, 8)}...</TableCell>
                  <TableCell>
                    <Chip 
                      label={trip.status} 
                      color={getStatusColor(trip.status) as "success" | "info" | "warning" | "error" | "default"} 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {trip.company?.name || "Unknown Company"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {trip.company?.email || "No email"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {trip.vehicle ? (
                      <>
                        <Typography variant="body2" fontWeight="medium">
                          {trip.vehicle.registrationNumber}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {trip.vehicle.type}
                        </Typography>
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No vehicle data
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {trip.createdBy?.name || "Unknown User"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {trip.createdBy?.email || "No email"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <Calendar size={16} style={{ marginRight: '4px' }} />
                      <Typography variant="body2">
                        {formatDate(trip.createdAt)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                      {trip.departureLocation ? (
                        <>
                          <strong>From:</strong> {trip.departureLocation.substring(0, 15)}...
                          <br />
                          <strong>To:</strong> {trip.destinationLocation?.substring(0, 15) || "N/A"}...
                        </>
                      ) : (
                        "No route data"
                      )}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Eye size={16} />}
                      onClick={() => handleViewDetails(trip.id)}
                    >
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {/* Pagination - simplified for now */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', p: 2 }}>
            <Button 
              disabled={page === 0} 
              onClick={() => handleChangePage(page - 1)}
            >
              Previous
            </Button>
            <Typography sx={{ mx: 2, display: 'flex', alignItems: 'center' }}>
              Page {page + 1}
            </Typography>
            <Button 
              disabled={(page + 1) * rowsPerPage >= totalTrips} 
              onClick={() => handleChangePage(page + 1)}
            >
              Next
            </Button>
          </Box>
        </TableContainer>
      )}
    </Box>
  );
} 
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
  Paper,
  Chip,
  Box,
  CircularProgress,
  Alert
} from "@mui/material";
import { ArrowLeft, Plus, Trash2, Eye } from "lucide-react";
import { format } from "date-fns";
import toast from "react-hot-toast";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { UserRole, EmployeeSubrole } from "@/prisma/enums";
import { SearchableTable } from "@/components/ui/searchable-table";

interface Session {
  id: string;
  source: string;
  destination: string;
  status: string;
  createdAt: string;
  company: {
    id: string;
    name: string;
  };
  createdBy: {
    id: string;
    name: string;
    email: string;
    subrole: string;
  };
  seal?: {
    id: string;
    barcode: string;
    verified: boolean;
    scannedAt: string | null;
  };
}

interface SessionError {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

export default function SessionsPage() {
  const router = useRouter();
  const { data: sessionData } = useSession();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<SessionError | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/sessions');
      
      if (!response.ok) {
        throw new Error('Failed to fetch sessions');
      }
      
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError({
        message: 'Failed to load sessions. Please try again later.',
        details: err instanceof Error ? { originalError: err.message } : undefined
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), "MMM d, yyyy");
  };

  const handleViewDetails = (sessionId: string) => {
    router.push(`/dashboard/sessions/${sessionId}`);
  };

  const handleAddSession = () => {
    router.push('/dashboard/sessions/create');
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Session deleted successfully');
        setSessions(sessions.filter((session) => session.id !== sessionId));
      } else {
        throw new Error(data.error || 'Failed to delete session');
      }
    } catch (err) {
      console.error('Error deleting session:', err);
      setError({
        message: 'Failed to delete session. Please try again later.',
        details: err instanceof Error ? { originalError: err.message } : undefined
      });
    }
  };

  // Check if user is an operator
  const isOperator = sessionData?.user?.role === UserRole.EMPLOYEE && 
                     sessionData?.user?.subrole === EmployeeSubrole.OPERATOR;

  // Define table columns
  const columns = [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }: { row: any }) => (
        <span>{row.id.substring(0, 8)}...</span>
      ),
      searchable: true,
    },
    {
      accessorKey: "source",
      header: "Source",
      searchable: true,
    },
    {
      accessorKey: "destination",
      header: "Destination",
      searchable: true,
    },
    {
      accessorKey: "company.name",
      header: "Company",
      searchable: true,
    },
    {
      accessorKey: "createdBy.name",
      header: "Created By",
      searchable: true,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }: { row: any }) => (
        <Chip 
          label={row.status} 
          color={row.status === "COMPLETED" ? "success" : "warning"}
          size="small"
          variant="outlined"
        />
      ),
      searchable: true,
    },
    {
      accessorKey: "createdAt",
      header: "Created On",
      cell: ({ row }: { row: any }) => (
        <span>{formatDate(row.createdAt)}</span>
      ),
      searchable: true,
    },
    {
      accessorKey: "actions",
      header: "Actions",
      cell: ({ row }: { row: any }) => (
        <Button
          component={Link}
          href={`/dashboard/sessions/${row.id}`}
          size="small"
          variant="outlined"
        >
          View Details
        </Button>
      ),
      searchable: false,
    },
  ];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={2}>
        <Alert severity="error">
          {error.message}
          {error.details && (
            <Typography variant="caption" display="block">
              {JSON.stringify(error.details)}
            </Typography>
          )}
        </Alert>
      </Box>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <Typography variant="h5" component="h1" fontWeight="bold">
          Sessions
        </Typography>
        {isOperator && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<Plus size={16} />}
            onClick={handleAddSession}
          >
            Add Session
          </Button>
        )}
      </div>

      <Paper>
        <SearchableTable columns={columns} data={sessions} />
      </Paper>
    </div>
  );
} 
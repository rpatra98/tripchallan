"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Divider, 
  Chip, 
  CircularProgress, 
  Button,
  Alert,
  AlertTitle
} from "@mui/material";
import { 
  LocationOn, 
  AccessTime, 
  ArrowBack
} from "@mui/icons-material";
import Link from "next/link";

export default function SessionDetailClient({ sessionId }: { sessionId: string }) {
  const { data: authSession, status: authStatus } = useSession();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();

  // Simplified fetch function
  useEffect(() => {
    async function fetchSession() {
      if (!sessionId) {
        setError("No session ID provided");
        setLoading(false);
        return;
      }
      
      try {
        console.log("Fetching session with ID:", sessionId);
        setLoading(true);
        const response = await fetch(`/api/sessions/${sessionId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch session: ${response.status}`);
        }
        
        const data = await response.json();
        console.log("Session data received:", data);
        setSession(data);
      } catch (err) {
        console.error("Error fetching session:", err);
        setError(`Failed to load session details: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        setLoading(false);
      }
    }
    
    fetchSession();
  }, [sessionId]);

  // Format date for display
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Simple status color mapping
  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "warning";
      case "IN_PROGRESS":
        return "info";
      case "COMPLETED":
        return "success";
      default:
        return "default";
    }
  };

  // Loading state
  if (authStatus === "loading" || loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Container maxWidth="md">
        <Box display="flex" flexDirection="column" alignItems="center" mt={4}>
          <Alert severity="error" sx={{ mb: 3, width: "100%" }}>
            <AlertTitle>Error Loading Session</AlertTitle>
            {error}
          </Alert>
          <Button
            component={Link}
            href="/dashboard/sessions"
            startIcon={<ArrowBack />}
          >
            Back to Sessions
          </Button>
        </Box>
      </Container>
    );
  }

  // No session found
  if (!session) {
    return (
      <Container maxWidth="md">
        <Box display="flex" flexDirection="column" alignItems="center" mt={4}>
          <Alert severity="info" sx={{ mb: 3, width: "100%" }}>
            <AlertTitle>Session Not Found</AlertTitle>
            No session data found with ID: {sessionId}
          </Alert>
          <Button
            component={Link}
            href="/dashboard/sessions"
            startIcon={<ArrowBack />}
          >
            Back to Sessions
          </Button>
        </Box>
      </Container>
    );
  }

  // Render session details
  return (
    <Container maxWidth="md">
      <Box mb={3}>
        <Button
          component={Link}
          href="/dashboard/sessions"
          startIcon={<ArrowBack />}
        >
          Back to Sessions
        </Button>
      </Box>

      {/* Basic details card */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            Session Details
          </Typography>
          <Chip 
            label={session.status || "UNKNOWN"} 
            color={getStatusColor(session.status)}
            size="medium"
          />
        </Box>

        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            Basic Information
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
              <Box display="flex" alignItems="center" mb={1}>
                <LocationOn color="primary" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Source:</strong> {session.source || "N/A"}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
              <Box display="flex" alignItems="center" mb={1}>
                <LocationOn color="primary" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Destination:</strong> {session.destination || "N/A"}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
              <Box display="flex" alignItems="center" mb={1}>
                <AccessTime color="primary" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Created:</strong> {session.createdAt ? formatDate(session.createdAt) : "N/A"}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
              <Box display="flex" alignItems="center" mb={1}>
                <Typography variant="body1">
                  <strong>Company:</strong> {session.company?.name || "N/A"}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Trip Details section */}
        {session.tripDetails && Object.keys(session.tripDetails).length > 0 && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              Trip Details
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {Object.entries(session.tripDetails || {}).map(([key, value]: [string, any]) => (
                value && (
                  <Box key={key} sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                    <Typography variant="body1">
                      <strong>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong> {String(value)}
                    </Typography>
                  </Box>
                )
              ))}
            </Box>
          </Box>
        )}

        {/* Debug section */}
        <Box mt={4} p={2} bgcolor="background.paper" border="1px solid" borderColor="divider" borderRadius={1}>
          <Typography variant="subtitle2" gutterBottom>Session ID: {sessionId}</Typography>
          <details>
            <summary>
              <Typography variant="caption">Debug Data</Typography>
            </summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
              {JSON.stringify(session, null, 2)}
            </pre>
          </details>
        </Box>
      </Paper>
    </Container>
  );
}
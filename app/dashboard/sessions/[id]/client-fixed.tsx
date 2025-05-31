"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import React from 'react';
import { 
  Container, 
  Typography, 
  Box, 
  Paper, 
  Divider, 
  Chip, 
  CircularProgress, 
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  AlertTitle,
  LinearProgress,
  List,
  ListItem,
  ListItemText
} from "@mui/material";
import { 
  LocationOn, 
  DirectionsCar, 
  AccessTime, 
  VerifiedUser, 
  ArrowBack, 
  Lock,
  CheckCircle,
  Warning,
  PictureAsPdf,
  TableChart,
  Description,
  Edit
} from "@mui/icons-material";
import Link from "next/link";
import { SessionStatus, EmployeeSubrole } from "@/lib/enums";
import CommentSection from "@/app/components/sessions/CommentSection";
import { jsPDF } from 'jspdf';

// Types
type SealType = {
  id: string;
  barcode: string;
  verified: boolean;
  scannedAt: string | null;
  verifiedById: string | null;
  verifiedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
};

type SessionType = {
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
  };
  seal?: SealType | null;
  // Additional trip details from the session creation form
  tripDetails?: {
    transporterName?: string;
    materialName?: string;
    vehicleNumber?: string;
    gpsImeiNumber?: string;
    driverName?: string;
    driverContactNumber?: string;
    loaderName?: string;
    challanRoyaltyNumber?: string;
    doNumber?: string;
    freight?: number;
    qualityOfMaterials?: string;
    tpNumber?: string;
    grossWeight?: number;
    tareWeight?: number;
    netMaterialWeight?: number;
    loaderMobileNumber?: string;
    loadingSite?: string;
    receiverPartyName?: string;
  };
  images?: {
    gpsImeiPicture?: string;
    vehicleNumberPlatePicture?: string;
    driverPicture?: string;
    sealingImages?: string[];
    vehicleImages?: string[];
    additionalImages?: string[];
  };
  timestamps?: {
    loadingDetails?: Record<string, string>;
    imagesForm?: Record<string, string>;
  };
  qrCodes?: {
    primaryBarcode?: string;
    additionalBarcodes?: string[];
  };
  activityLogs?: {
    id: string;
    action: string;
    details?: {
      verification?: {
        fieldVerifications?: Record<string, any>;
        allMatch?: boolean;
      };
    };
  }[];
};

export default function SessionDetailClient({ sessionId }: { sessionId: string }) {
  const { data: authSession, status: authStatus } = useSession();
  const [session, setSession] = useState<SessionType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const router = useRouter();
  const [userRole, setUserRole] = useState("");
  const [userSubrole, setUserSubrole] = useState("");
  const [reportLoading, setReportLoading] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  
  // New state for guard verification
  const [verificationFormOpen, setVerificationFormOpen] = useState(false);
  const [verificationFields, setVerificationFields] = useState<{[key: string]: {
    operatorValue: any;
    guardValue: any;
    comment: string;
    isVerified: boolean;
  }}>({});
  const [verificationStep, setVerificationStep] = useState(0);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [sealInput, setSealInput] = useState("");
  const [sealError, setSealError] = useState("");
  const [imageVerificationStatus, setImageVerificationStatus] = useState<{[key: string]: boolean}>({});

  // Check if user is a guard
  const isGuard = useMemo(() => 
    userRole === "EMPLOYEE" && userSubrole === EmployeeSubrole.GUARD, 
    [userRole, userSubrole]
  );
  
  // Check if user can access reports (non-GUARD users)
  const canAccessReports = useMemo(() => 
    userRole === "SUPERADMIN" || 
    userRole === "ADMIN" || 
    userRole === "COMPANY", 
    [userRole]
  );
  
  // Check if the session can be verified
  const canVerify = useMemo(() => 
    isGuard && 
    session?.status === SessionStatus.IN_PROGRESS && 
    session?.seal && 
    !session.seal.verified,
    [isGuard, session]
  );

  // Define placeholder functions for the fixed client version
  const renderVerificationResults = () => null;
  const startVerification = () => {};
  const closeConfirmDialog = () => {};

  // Report download handlers
  const handleDownloadReport = async (format: string) => {
    if (!sessionId) return;
    
    try {
      setReportLoading(format);
      let endpoint = "";
      
      switch (format) {
        case "pdf":
          endpoint = `/api/reports/sessions/${sessionId}/pdf/simple`;
          break;
        case "excel":
          endpoint = `/api/reports/sessions/${sessionId}/excel`;
          break;
        default:
          throw new Error("Unsupported report format");
      }
      
      // Get the report as a blob
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(errorData || `Failed to download ${format} report`);
      }
      
      // Convert response to blob
      const blob = await response.blob();
      
      // Create a link element to trigger the download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `session-${sessionId}.${format === "excel" ? "xlsx" : "pdf"}`;
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
    } catch (err) {
      console.error(`Error downloading ${format} report:`, err);
      alert(`Failed to download ${format} report: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setReportLoading(null);
    }
  };

  // Define fetchSessionDetails function
  const fetchSessionDetails = useCallback(async () => {
    if (!sessionId) {
      console.log("No session ID available yet, skipping fetch");
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      console.log("Fetching session details for ID:", sessionId);
      const response = await fetch(`/api/session/${sessionId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error (${response.status}):`, errorText);
        
        if (response.status === 404) {
          throw new Error("Session not found");
        } else {
          throw new Error(`Failed to fetch session details: ${response.status} ${response.statusText}`);
        }
      }
      
      const data = await response.json();
      console.log("Session data received:", !!data);
      setSession(data);
    } catch (err) {
      console.error("Error fetching session details:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Other functions and useEffect hooks

  // Modified Verification Box for Guards
  if (canVerify) {
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

        {/* Session Details View */}
        {!verificationFormOpen && (
          <>
            <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
              {/* Content for session details */}
            </Paper>

            {/* Comment section */}
            <CommentSection sessionId={sessionId} />

            {/* Verification Results */}
            {renderVerificationResults()}
          </>
        )}

        {/* Verification Form */}
        {verificationFormOpen && (
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            {/* Verification form content */}
          </Paper>
        )}

        {/* Verification Button */}
        {!verificationFormOpen && (
          <Box sx={{ display: "flex", justifyContent: "center", mt: 3 }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              startIcon={<Lock />}
              onClick={startVerification}
            >
              Start Trip Verification
            </Button>
          </Box>
        )}

        {/* Confirmation Dialog */}
        <Dialog open={confirmDialogOpen} onClose={closeConfirmDialog}>
          {/* Dialog content */}
        </Dialog>

        {/* Success Notification */}
        {verificationSuccess && (
          <Alert severity="success" sx={{ mt: 3 }}>
            <AlertTitle>Success!</AlertTitle>
            Trip successfully verified.
          </Alert>
        )}
      </Container>
    );
  }

  // Main component return for non-verification users
  return (
    <Container maxWidth="md">
      {/* Content */}
      <CommentSection sessionId={sessionId} />

      {/* Images Section - Comes before Reports section */}
      {session && session.images && Object.keys(session.images).some(key => {
        const value = session.images && session.images[key as keyof typeof session.images];
        return !!value;
      }) && (
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Images
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {session.images.driverPicture && (
              <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                <Typography variant="subtitle2" gutterBottom>Driver</Typography>
                <img 
                  src={session.images.driverPicture} 
                  alt="Driver" 
                  style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                />
              </Box>
            )}
            {session.images.vehicleNumberPlatePicture && (
              <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                <Typography variant="subtitle2" gutterBottom>Number Plate</Typography>
                <img 
                  src={session.images.vehicleNumberPlatePicture} 
                  alt="Vehicle Number Plate" 
                  style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                />
              </Box>
            )}
            {session.images.gpsImeiPicture && (
              <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                <Typography variant="subtitle2" gutterBottom>GPS/IMEI</Typography>
                <img 
                  src={session.images.gpsImeiPicture} 
                  alt="GPS IMEI" 
                  style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                />
              </Box>
            )}
            
            {/* Display all sealing images */}
            {session.images.sealingImages && session.images.sealingImages.length > 0 && (
              <>
                <Box sx={{ width: '100%', mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Sealing Images</Typography>
                </Box>
                {session.images.sealingImages.map((image, index) => (
                  <Box key={`sealing-${index}`} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                    <img 
                      src={image} 
                      alt={`Sealing ${index + 1}`} 
                      style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                    />
                  </Box>
                ))}
              </>
            )}
            
            {/* Display all vehicle images */}
            {session.images.vehicleImages && session.images.vehicleImages.length > 0 && (
              <>
                <Box sx={{ width: '100%', mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Vehicle Images</Typography>
                </Box>
                {session.images.vehicleImages.map((image, index) => (
                  <Box key={`vehicle-${index}`} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                    <img 
                      src={image} 
                      alt={`Vehicle ${index + 1}`} 
                      style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                    />
                  </Box>
                ))}
              </>
            )}
            
            {/* Display all additional images */}
            {session.images.additionalImages && session.images.additionalImages.length > 0 && (
              <>
                <Box sx={{ width: '100%', mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>Additional Images</Typography>
                </Box>
                {session.images.additionalImages.map((image, index) => (
                  <Box key={`additional-${index}`} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                    <img 
                      src={image} 
                      alt={`Additional ${index + 1}`} 
                      style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                    />
                  </Box>
                ))}
              </>
            )}
          </Box>
        </Paper>
      )}

      {/* Report Download Section - Only shown to authorized users */}
      {canAccessReports && (
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Reports
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              startIcon={<PictureAsPdf />}
              onClick={() => handleDownloadReport("pdf")}
              disabled={reportLoading !== null}
              size="small"
              sx={{ color: 'error.main', borderColor: 'error.main', '&:hover': { borderColor: 'error.dark' } }}
            >
              {reportLoading === "pdf" ? "Downloading..." : "Download PDF"}
            </Button>
            <Button
              variant="outlined"
              startIcon={<TableChart />}
              onClick={() => handleDownloadReport("excel")}
              disabled={reportLoading !== null}
              size="small"
              sx={{ color: 'success.main', borderColor: 'success.main', '&:hover': { borderColor: 'success.dark' } }}
            >
              {reportLoading === "excel" ? "Downloading..." : "Download Excel"}
            </Button>
          </Box>
        </Paper>
      )}

      {/* Verification Results */}
      {renderVerificationResults()}
    </Container>
  );
} 
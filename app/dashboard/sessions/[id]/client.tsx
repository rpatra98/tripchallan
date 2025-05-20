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
  ListItemText,
  TableContainer,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  IconButton,
  Grid as MuiGrid
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
  Edit,
  BusinessCenter,
  RadioButtonUnchecked,
  Comment,
  ArrowForward
} from "@mui/icons-material";
import Link from "next/link";
import { SessionStatus, EmployeeSubrole } from "@/prisma/enums";
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

// For Material-UI Grid component
const Grid = MuiGrid;

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
      
      // Try both API endpoints to provide redundancy
      const apiUrls = [
        `/api/session/${sessionId}`,
        `/api/sessions/${sessionId}`
      ];
      
      let response;
      let errorText = '';
      
      // Try each endpoint until one works
      for (const url of apiUrls) {
        console.log(`Attempting to fetch from ${url}`);
        try {
          response = await fetch(url);
          if (response.ok) {
            console.log(`Successfully fetched data from ${url}`);
            break;
          } else {
            const error = await response.text();
            errorText += `${url}: ${response.status} - ${error}\n`;
            console.error(`API Error (${response.status}) from ${url}:`, error);
          }
        } catch (err) {
          errorText += `${url}: ${err}\n`;
          console.error(`Fetch error from ${url}:`, err);
        }
      }
      
      if (!response || !response.ok) {
        throw new Error(`Failed to fetch session details: ${errorText}`);
      }
      
      const data = await response.json();
      console.log("Session data received:", !!data, data ? Object.keys(data) : 'no data');
      setSession(data);
    } catch (err) {
      console.error("Error fetching session details:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (authStatus === "authenticated" && authSession?.user && sessionId) {
      setUserRole(authSession.user.role as string);
      setUserSubrole(authSession.user.subrole as string);
      fetchSessionDetails();
    }
  }, [authStatus, authSession, sessionId, fetchSessionDetails]);

  // Check if user has edit permission
  useEffect(() => {
    // Only OPERATOR users with canModify permission can edit
    if (userRole === "EMPLOYEE" && userSubrole === EmployeeSubrole.OPERATOR && authSession?.user?.id) {
      fetch(`/api/employees/${authSession.user.id}/permissions`)
        .then(response => response.json())
        .then(data => {
          setCanEdit(data.canModify || false);
        })
        .catch(error => {
          console.error("Error checking edit permission:", error);
          setCanEdit(false);
        });
    } else {
      setCanEdit(false);
    }
  }, [userRole, userSubrole, authSession?.user?.id]);

  useEffect(() => {
    // Initialize verification fields when session data is loaded
    if (session && isGuard) {
      const fields: {[key: string]: any} = {};
      
      // Add trip details fields for verification
      if (session.tripDetails) {
        Object.entries(session.tripDetails).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            fields[key] = {
              operatorValue: value,
              guardValue: '',
              comment: '',
              isVerified: false
            };
          }
        });
      }
      
      setVerificationFields(fields);
      
      // Initialize image verification status
      const imageStatus: {[key: string]: boolean} = {};
      if (session.images) {
        if (session.images.driverPicture) imageStatus['driverPicture'] = false;
        if (session.images.vehicleNumberPlatePicture) imageStatus['vehicleNumberPlatePicture'] = false;
        if (session.images.gpsImeiPicture) imageStatus['gpsImeiPicture'] = false;
        if (session.images.sealingImages?.length) imageStatus['sealingImages'] = false;
        if (session.images.vehicleImages?.length) imageStatus['vehicleImages'] = false;
        if (session.images.additionalImages?.length) imageStatus['additionalImages'] = false;
      }
      
      setImageVerificationStatus(imageStatus);
    }
  }, [session, isGuard]);

  // Calculate verification progress
  useEffect(() => {
    if (Object.keys(verificationFields).length === 0) return;
    
    const verified = Object.values(verificationFields).filter(f => f.isVerified).length;
    const total = Object.keys(verificationFields).length;
    
    const imagesVerified = Object.values(imageVerificationStatus).filter(status => status).length;
    const totalImages = Object.keys(imageVerificationStatus).length;
    
    // Add 1 for seal verification at the end
    const progress = Math.round(
      ((verified + imagesVerified) / (total + totalImages + 1)) * 100
    );
    
    setVerificationProgress(progress);
  }, [verificationFields, imageVerificationStatus]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case SessionStatus.PENDING:
        return "warning";
      case SessionStatus.IN_PROGRESS:
        return "info";
      case SessionStatus.COMPLETED:
        return "success";
      default:
        return "default";
    }
  };

  const startVerification = () => {
    setVerificationFormOpen(true);
    setVerificationStep(0);
  };
  
  const handleInputChange = (field: string, value: any) => {
    setVerificationFields(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        guardValue: value
      }
    }));
  };
  
  const handleCommentChange = (field: string, comment: string) => {
    setVerificationFields(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        comment
      }
    }));
  };
  
  const verifyField = (field: string) => {
    // Get field data but don't show operator value to GUARD
    const fieldData = verificationFields[field];
    
    // Guard must enter a value
    if (!fieldData.guardValue || fieldData.guardValue.trim() === '') {
      alert('Please enter a value before verifying this field.');
      return false;
    }
    
    // Mark as verified without showing if it matches
    setVerificationFields(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        isVerified: true
      }
    }));
    
    // Still check for match in background (for stats and verification results)
    const match = String(fieldData.operatorValue).toLowerCase() === String(fieldData.guardValue).toLowerCase();
    return match;
  };
  
  const verifyImage = (imageKey: string) => {
    setImageVerificationStatus(prev => ({
      ...prev,
      [imageKey]: true
    }));
  };
  
  const verifyAllFields = () => {
    // Mark all fields as verified
    const updatedFields = {...verificationFields};
    Object.keys(updatedFields).forEach(field => {
      updatedFields[field].isVerified = true;
    });
    setVerificationFields(updatedFields);
    
    // Move to image verification
    setVerificationStep(1);
  };
  
  const getFieldLabel = (key: string): string => {
    // Convert camelCase to Title Case with spaces
    return key.replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };
  
  // Calculate verification statistics
  const getVerificationStats = () => {
    // Field verification stats
    const fieldStats = {
      verified: Object.values(verificationFields).filter(field => field.isVerified).length,
      matched: Object.values(verificationFields).filter(field => 
        field.isVerified && field.operatorValue === field.guardValue
      ).length,
      mismatched: Object.values(verificationFields).filter(field => 
        field.isVerified && field.operatorValue !== field.guardValue
      ).length,
      total: Object.keys(verificationFields).length
    };

    // Image verification stats
    const imageStats = {
      verified: Object.values(imageVerificationStatus).filter(status => status).length,
      total: Object.keys(imageVerificationStatus).length
    };

    // Combined stats for summary display
    const total = fieldStats.total + imageStats.total;
    const verified = fieldStats.verified + imageStats.verified;

    return {
      fieldStats,
      imageStats,
      total,
      verified
    };
  };
  
  // Modified version of handleVerifySeal to include validation of GUARD entered seal
  const handleVerifySeal = async () => {
    if (!session?.seal) return;
    
    // Validate seal input
    if (!sealInput) {
      setSealError("Please enter the seal barcode");
      return;
    }
    
    // Check if seal matches
    if (sealInput !== session.seal.barcode) {
      setSealError("The seal barcode you entered does not match the expected seal. Please verify and try again.");
      return;
    }
    
    // Verify all fields have been filled out
    const unverifiedFields = Object.keys(verificationFields).filter(field => 
      !verificationFields[field].isVerified
    );
    
    if (unverifiedFields.length > 0) {
      setError("Please verify all fields before completing the verification process");
      return;
    }
    
    // Check if all images have been verified
    const unverifiedImages = Object.keys(imageVerificationStatus).filter(key => 
      !imageVerificationStatus[key]
    );
    
    if (unverifiedImages.length > 0) {
      setError("Please verify all images before completing the verification process");
      return;
    }
    
    setVerifying(true);
    setError("");
    setSealError("");
    
    try {
      // Calculate verification results for each field
      const fieldVerificationResults = Object.entries(verificationFields).reduce(
        (results, [field, data]) => {
          results[field] = {
            operatorValue: data.operatorValue,
            guardValue: data.guardValue,
            matches: data.operatorValue === data.guardValue,
            comment: data.comment
          };
          return results;
        },
        {} as Record<string, any>
      );
      
      const response = await fetch("/api/seals", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          sealId: session.seal.id,
          verificationData: {
            fieldVerifications: fieldVerificationResults,
            imageVerifications: imageVerificationStatus,
            allMatch: Object.values(fieldVerificationResults).every(v => v.matches)
          }
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to verify seal");
      }
      
      setVerificationSuccess(true);
      setVerificationFormOpen(false);
      // Refresh session details after verification
      fetchSessionDetails();
    } catch (err) {
      console.error("Error verifying seal:", err);
      setError(err instanceof Error ? err.message : "Failed to verify seal");
    } finally {
      setVerifying(false);
      setConfirmDialogOpen(false);
    }
  };
  
  const openConfirmDialog = () => {
    setConfirmDialogOpen(true);
  };
  
  const closeConfirmDialog = () => {
    setConfirmDialogOpen(false);
  };

  // Verification Form Step 1: Trip Details Verification
  const renderTripDetailsVerification = () => {
    if (!session || !session.tripDetails) {
      return (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No trip details available for verification.
          </Typography>
        </Box>
      );
    }

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Trip Details Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Please enter and verify each trip detail by physically checking the actual values. Your entries will be compared with the operator's data during submission.
        </Typography>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'background.paper' }}>
                <TableCell width="40%"><strong>Field</strong></TableCell>
                <TableCell width="45%"><strong>Your Verification</strong></TableCell>
                <TableCell width="15%"><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(verificationFields).map(([field, data]) => (
                <TableRow key={field} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  <TableCell component="th" scope="row">
                    {getFieldLabel(field)}
                  </TableCell>
                  <TableCell>
                    <TextField 
                      size="small"
                      fullWidth
                      variant="outlined"
                      value={data.guardValue || ''}
                      onChange={(e) => handleInputChange(field, e.target.value)}
                      placeholder="Enter verified value"
                    />
                    {data.comment && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Comment: {data.comment}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box display="flex" flexDirection="column" alignItems="center">
                      <IconButton 
                        color={data.isVerified ? "success" : "default"}
                        onClick={() => verifyField(field)}
                        size="small"
                      >
                        {data.isVerified ? (
                          <CheckCircle fontSize="small" />
                        ) : (
                          <RadioButtonUnchecked fontSize="small" />
                        )}
                      </IconButton>
                      <IconButton 
                        size="small" 
                        onClick={() => {
                          const comment = prompt("Add a comment about this field:", data.comment || "");
                          if (comment !== null) {
                            handleCommentChange(field, comment);
                          }
                        }}
                        sx={{ mt: 0.5 }}
                      >
                        <Comment fontSize="small" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box display="flex" justifyContent="space-between" sx={{ mt: 4 }}>
          <Button
            variant="outlined"
            color="primary"
            onClick={verifyAllFields}
          >
            Verify All Fields
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={() => setVerificationStep(1)}
            endIcon={<ArrowForward />}
          >
            Next: Image Verification
          </Button>
        </Box>
      </Box>
    );
  };

  // Verification Form Step 2: Image Verification
  const renderImageVerification = () => {
    if (!session || !session.images) {
      return (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No images available for verification.
          </Typography>
        </Box>
      );
    }

    // Check if any images exist
    const hasImages = Object.keys(session.images).some(key => {
      const value = session.images && session.images[key as keyof typeof session.images];
      return !!value;
    });

    if (!hasImages) {
      return (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No images available for verification.
          </Typography>
        </Box>
      );
    }

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Image Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Please verify each image by checking it against the physical items.
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {session.images.driverPicture && (
            <Box sx={{ flex: '1 0 45%', minWidth: '300px' }}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom>Driver Photo</Typography>
                <Box sx={{ mb: 2 }}>
                  <img 
                    src={session.images.driverPicture} 
                    alt="Driver" 
                    style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                  />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">
                    Verified: {imageVerificationStatus.driverPicture ? 'Yes' : 'No'}
                  </Typography>
                  <Button 
                    variant={imageVerificationStatus.driverPicture ? "contained" : "outlined"}
                    color={imageVerificationStatus.driverPicture ? "success" : "primary"}
                    size="small"
                    onClick={() => verifyImage('driverPicture')}
                    startIcon={imageVerificationStatus.driverPicture ? <CheckCircle /> : <RadioButtonUnchecked />}
                  >
                    {imageVerificationStatus.driverPicture ? "Verified" : "Verify"}
                  </Button>
                </Box>
              </Paper>
            </Box>
          )}

          {session.images.vehicleNumberPlatePicture && (
            <Box sx={{ flex: '1 0 45%', minWidth: '300px' }}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom>Vehicle Number Plate</Typography>
                <Box sx={{ mb: 2 }}>
                  <img 
                    src={session.images.vehicleNumberPlatePicture} 
                    alt="Vehicle Number Plate" 
                    style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                  />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">
                    Verified: {imageVerificationStatus.vehicleNumberPlatePicture ? 'Yes' : 'No'}
                  </Typography>
                  <Button 
                    variant={imageVerificationStatus.vehicleNumberPlatePicture ? "contained" : "outlined"}
                    color={imageVerificationStatus.vehicleNumberPlatePicture ? "success" : "primary"}
                    size="small"
                    onClick={() => verifyImage('vehicleNumberPlatePicture')}
                    startIcon={imageVerificationStatus.vehicleNumberPlatePicture ? <CheckCircle /> : <RadioButtonUnchecked />}
                  >
                    {imageVerificationStatus.vehicleNumberPlatePicture ? "Verified" : "Verify"}
                  </Button>
                </Box>
              </Paper>
            </Box>
          )}

          {session.images.gpsImeiPicture && (
            <Box sx={{ flex: '1 0 45%', minWidth: '300px' }}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Typography variant="subtitle1" gutterBottom>GPS/IMEI</Typography>
                <Box sx={{ mb: 2 }}>
                  <img 
                    src={session.images.gpsImeiPicture} 
                    alt="GPS IMEI" 
                    style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                  />
                </Box>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2">
                    Verified: {imageVerificationStatus.gpsImeiPicture ? 'Yes' : 'No'}
                  </Typography>
                  <Button 
                    variant={imageVerificationStatus.gpsImeiPicture ? "contained" : "outlined"}
                    color={imageVerificationStatus.gpsImeiPicture ? "success" : "primary"}
                    size="small"
                    onClick={() => verifyImage('gpsImeiPicture')}
                    startIcon={imageVerificationStatus.gpsImeiPicture ? <CheckCircle /> : <RadioButtonUnchecked />}
                  >
                    {imageVerificationStatus.gpsImeiPicture ? "Verified" : "Verify"}
                  </Button>
                </Box>
              </Paper>
            </Box>
          )}

          {/* Sealing Images */}
          {session.images.sealingImages && session.images.sealingImages.length > 0 && (
            <Box sx={{ width: '100%' }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>Sealing Images</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {session.images.sealingImages.map((image, index) => (
                    <Box key={`sealing-${index}`} sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                      <img 
                        src={image} 
                        alt={`Sealing ${index + 1}`} 
                        style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '4px' }} 
                      />
                    </Box>
                  ))}
                </Box>
                <Box display="flex" justifyContent="flex-end" sx={{ mt: 2 }}>
                  <Button 
                    variant={imageVerificationStatus.sealingImages ? "contained" : "outlined"}
                    color={imageVerificationStatus.sealingImages ? "success" : "primary"}
                    size="small"
                    onClick={() => verifyImage('sealingImages')}
                    startIcon={imageVerificationStatus.sealingImages ? <CheckCircle /> : <RadioButtonUnchecked />}
                  >
                    {imageVerificationStatus.sealingImages ? "Verified" : "Verify All Sealing Images"}
                  </Button>
                </Box>
              </Paper>
            </Box>
          )}

          {/* Navigation Buttons */}
          <Box sx={{ width: '100%', mt: 3 }}>
            <Box display="flex" justifyContent="space-between">
              <Button
                variant="outlined"
                color="primary"
                onClick={() => setVerificationStep(0)}
                startIcon={<ArrowBack />}
              >
                Back to Trip Details
              </Button>
              <Button
                variant="contained"
                color="primary"
                onClick={() => setVerificationStep(2)}
                endIcon={<ArrowForward />}
              >
                Next: Seal Verification
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    );
  };

  // Verification Form Step 3: Seal Verification
  const renderSealVerification = () => {
    if (!session || !session.seal) {
      return (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No seal information available for verification.
          </Typography>
        </Box>
      );
    }

    // Get verification stats for display
    const stats = getVerificationStats();

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Seal Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Please verify the physical seal and complete the verification process.
        </Typography>

        <Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Seal Information
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                  <Typography variant="body1">
                    <strong>Barcode:</strong> {session.seal.barcode}
                  </Typography>
                </Box>
                <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                  <Typography variant="body1">
                    <strong>Status:</strong>{" "}
                    <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
                      Unverified <Warning color="warning" sx={{ ml: 0.5 }} />
                    </Box>
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Divider />

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Verification Summary
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
                <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                  <Paper sx={{ p: 2, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
                    <Typography variant="h4" align="center">{stats.total}</Typography>
                    <Typography variant="body2" align="center">Total Fields</Typography>
                  </Paper>
                </Box>
                <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                  <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                    <Typography variant="h4" align="center">{stats.verified}</Typography>
                    <Typography variant="body2" align="center">Verified Fields</Typography>
                  </Paper>
                </Box>
                <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                  <Paper sx={{ p: 2, bgcolor: 'warning.light', color: 'warning.contrastText' }}>
                    <Typography variant="h4" align="center">{stats.total - stats.verified}</Typography>
                    <Typography variant="body2" align="center">Pending Fields</Typography>
                  </Paper>
                </Box>
              </Box>

              <Alert severity={stats.verified === stats.total ? "success" : "warning"} sx={{ mb: 3 }}>
                <AlertTitle>{stats.verified === stats.total ? "Ready to Complete" : "Verification Incomplete"}</AlertTitle>
                {stats.verified === stats.total 
                  ? "All fields have been verified. You can now complete the verification process."
                  : `${stats.total - stats.verified} field(s) still need verification. Please go back and complete all verifications.`
                }
              </Alert>
            </Box>
          </Box>
        </Paper>

        <Box display="flex" justifyContent="space-between">
          <Button
            variant="outlined"
            color="primary"
            onClick={() => setVerificationStep(1)}
            startIcon={<ArrowBack />}
          >
            Back to Images
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={openConfirmDialog}
            endIcon={<CheckCircle />}
            disabled={stats.verified < stats.total}
          >
            Complete Verification
          </Button>
        </Box>
      </Box>
    );
  };

  // Add a new function to display verification results
  const renderVerificationResults = () => {
    // Contents of renderVerificationResults function
    return null;
  };

  if (authStatus === "loading" || loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Container maxWidth="md">
        <Box display="flex" flexDirection="column" alignItems="center" mt={4}>
          <Alert severity="error" sx={{ mb: 3, width: "100%" }}>
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

  if (!session) {
    return (
      <Container maxWidth="md">
        <Box display="flex" flexDirection="column" alignItems="center" mt={4}>
          <Alert severity="info" sx={{ mb: 3, width: "100%" }}>
            Session not found
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
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h4" component="h1">
                  {isGuard ? "Trip Details" : "Session Details"}
                </Typography>
                <Box display="flex" alignItems="center" gap={2}>
                  {canEdit && session.status !== SessionStatus.COMPLETED && (
                    <Button
                      component={Link}
                      href={`/dashboard/sessions/${sessionId}/edit`}
                      startIcon={<Edit />}
                      variant="outlined"
                      size="small"
                    >
                      Edit
                    </Button>
                  )}
                  <Chip 
                    label={session.status} 
                    color={getStatusColor(session.status)}
                    size="medium"
                  />
                </Box>
              </Box>
              
              {/* Additional session details */}
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
            {verificationStep === 0 && renderTripDetailsVerification()}
            {verificationStep === 1 && renderImageVerification()}
            {verificationStep === 2 && renderSealVerification()}
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
          <DialogTitle>Confirm Verification</DialogTitle>
          <DialogContent>
            <DialogContentText>
              Are you sure you want to verify this seal? This action cannot be undone.
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeConfirmDialog} color="primary">
              Cancel
            </Button>
            <Button onClick={handleVerifySeal} color="primary" disabled={verifying}>
              {verifying ? "Verifying..." : "Verify"}
            </Button>
          </DialogActions>
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

      {/* Main content */}
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4" component="h1">
            Session Details
          </Typography>
          <Box display="flex" alignItems="center" gap={2}>
            {canEdit && session.status !== SessionStatus.COMPLETED && (
              <Button
                component={Link}
                href={`/dashboard/sessions/${sessionId}/edit`}
                startIcon={<Edit />}
                variant="outlined"
                size="small"
              >
                Edit
              </Button>
            )}
            <Chip 
              label={session.status} 
              color={getStatusColor(session.status)}
              size="medium"
            />
          </Box>
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
                  <strong>Source:</strong> {session.source}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
              <Box display="flex" alignItems="center" mb={1}>
                <LocationOn color="primary" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Destination:</strong> {session.destination}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
              <Box display="flex" alignItems="center" mb={1}>
                <AccessTime color="primary" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Created:</strong> {formatDate(session.createdAt)}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
              <Box display="flex" alignItems="center" mb={1}>
                <BusinessCenter color="primary" sx={{ mr: 1 }} />
                <Typography variant="body1">
                  <strong>Company:</strong> {session.company?.name || "N/A"}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {session.tripDetails && Object.keys(session.tripDetails).length > 0 && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              Trip Details
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {Object.entries(session.tripDetails).map(([key, value]) => (
                value && (
                  <Box key={key} sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                    <Typography variant="body1">
                      <strong>{getFieldLabel(key)}:</strong> {String(value)}
                    </Typography>
                  </Box>
                )
              ))}
            </Box>
          </Box>
        )}

        {session.seal && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              Seal Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                <Typography variant="body1">
                  <strong>Barcode:</strong> {session.seal.barcode}
                </Typography>
              </Box>
              <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                <Typography variant="body1">
                  <strong>Status:</strong>{" "}
                  {session.seal.verified ? (
                    <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
                      Verified <CheckCircle color="success" sx={{ ml: 0.5 }} />
                    </Box>
                  ) : (
                    <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
                      Unverified <Warning color="warning" sx={{ ml: 0.5 }} />
                    </Box>
                  )}
                </Typography>
              </Box>
              {session.seal.verified && session.seal.verifiedBy && (
                <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                  <Typography variant="body1">
                    <strong>Verified By:</strong> {session.seal.verifiedBy.name}
                  </Typography>
                </Box>
              )}
              {session.seal.verified && session.seal.scannedAt && (
                <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                  <Typography variant="body1">
                    <strong>Verified At:</strong> {formatDate(session.seal.scannedAt)}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        )}

        {/* Images section - moved before Reports section */}
        {session.images && Object.keys(session.images).some(key => {
          const value = session.images && session.images[key as keyof typeof session.images];
          return !!value;
        }) && (
          <Box mb={3}>
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
          </Box>
        )}

        {/* Report Download Section - Only shown to authorized users */}
        {canAccessReports && (
          <Box mb={3}>
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
          </Box>
        )}
      </Paper>

      {/* Comment section */}
      <CommentSection sessionId={sessionId} />

      {/* Verification Results */}
      {renderVerificationResults()}
    </Container>
  );
}
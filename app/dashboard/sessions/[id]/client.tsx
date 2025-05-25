"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
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
  InputAdornment,
  Tooltip,
  Backdrop,
  FormControl,
  FormControlLabel,
  FormLabel,
  RadioGroup,
  Radio,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  InputLabel,
  Select,
  MenuItem,
  CardHeader,
  CardMedia,
  CardContent,
  CardActions,
  Badge,
  Grid
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
  ArrowForward,
  Delete,
  CloudUpload,
  Close,
  QrCode,
  InfoOutlined,
  Refresh
} from "@mui/icons-material";
import Link from "next/link";
import { SessionStatus, EmployeeSubrole, SealStatus, ActivityAction, UserRole } from "@/prisma/enums";
import CommentSection from "@/app/components/sessions/CommentSection";
import SealVerification from "@/app/components/sessions/SealVerification";
import useSessionSeals from "@/app/hooks/useSessionSeals";
import { jsPDF } from 'jspdf';
import ClientSideQrScanner from "@/app/components/ClientSideQrScanner";

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
  verificationData?: {
    fieldVerifications?: Record<string, any>;
    guardImages?: Record<string, any>;
    sealBarcode?: string | null;
    allMatch?: boolean;
    verificationTimestamp?: string;
  };
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
    createdAt?: string;
    details?: {
      verification?: {
        fieldVerifications?: Record<string, any>;
        allMatch?: boolean;
      };
    };
  }[];
};

// Add interfaces for status updates
interface SealStatusUpdate {
  sealId: string;
  status: string;
  comment?: string;
  evidence?: SealStatusEvidence;
}

interface SealStatusEvidence {
  photos?: string[];
  description?: string;
}

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
  const [verificationFields, setVerificationFields] = useState<Record<string, any>>({});
  const [verificationStep, setVerificationStep] = useState(0);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [sealInput, setSealInput] = useState("");
  const [sealError, setSealError] = useState("");
  const [imageVerificationStatus, setImageVerificationStatus] = useState<Record<string, boolean>>({});
  const [imageComments, setImageComments] = useState<Record<string, string>>({});
  
  // Add state for session seals
  const [sessionSeals, setSessionSeals] = useState<any[]>([]);
  const [loadingSeals, setLoadingSeals] = useState(false);
  const [sealsError, setSealsError] = useState("");
  const [scannedSealIds, setScannedSealIds] = useState<Set<string>>(new Set());
  const [selectedSeal, setSelectedSeal] = useState<any>(null);
  const [unscannedSealIds, setUnscannedSealIds] = useState<string[]>([]);
  const [sealStatusUpdates, setSealStatusUpdates] = useState<Record<string, SealStatusUpdate>>({});
  const [selectedSealForStatus, setSelectedSealForStatus] = useState<any>(null);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [statusComment, setStatusComment] = useState('');
  const [statusEvidence, setStatusEvidence] = useState<SealStatusEvidence>({ photos: [] });
  const [isSubmittingStatus, setIsSubmittingStatus] = useState(false);
  const [completingVerification, setCompletingVerification] = useState(false);
  const [verificationSummaryOpen, setVerificationSummaryOpen] = useState(false);
  const [verificationSummary, setVerificationSummary] = useState<any>(null);
  
  // Add ref for file input
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Add new state for verification tabs
  const [activeTab, setActiveTab] = useState(0);
  const verificationTabs = ['Loading Details', 'Seal Tags', 'Driver Details', 'Images'];
  
  // Add new state for guard's uploaded images
  const [guardImages, setGuardImages] = useState<{
    driverPicture?: File | null;
    vehicleNumberPlatePicture?: File | null;
    gpsImeiPicture?: File | null;
    sealingImages?: File[];
    vehicleImages?: File[];
    additionalImages?: File[];
  }>({
    driverPicture: null,
    vehicleNumberPlatePicture: null,
    gpsImeiPicture: null,
    sealingImages: [],
    vehicleImages: [],
    additionalImages: []
  });

  // Add state for image previews
  const [imagePreviews, setImagePreviews] = useState<{
    driverPicture?: string;
    vehicleNumberPlatePicture?: string;
    gpsImeiPicture?: string;
    sealingImages?: string[];
    vehicleImages?: string[];
    additionalImages?: string[];
  }>({
    sealingImages: [],
    vehicleImages: [],
    additionalImages: []
  });
  
  // Add state for verification results to display matched/mismatched fields
  const [verificationResults, setVerificationResults] = useState<{
    matches: string[];
    mismatches: string[];
    unverified: string[];
    allFields: Record<string, {
      operatorValue: any;
      guardValue: any;
      matches: boolean;
      comment: string;
      isVerified: boolean;
    }>;
    timestamp: string;
  } | null>(null);
  
  // New state for seal tag verification
  const [scanInput, setScanInput] = useState('');
  const [scanMethod, setScanMethod] = useState('manual');
  const [scanError, setScanError] = useState('');
  const [guardScannedSeals, setGuardScannedSeals] = useState<Array<{
    id: string;
    method: string;
    image: File | null;
    imagePreview: string | null;
    timestamp: string;
    verified: boolean;
  }>>([]);
  const [sealComparison, setSealComparison] = useState<{
    matched: string[];
    mismatched: string[];
  }>({
    matched: [],
    mismatched: []
  });
  
  // Add a new state for the details dialog
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  
  // Utility functions needed before other definitions
  const getFieldLabel = useCallback((key: string): string => {
    // Convert camelCase to Title Case with spaces
    return key.replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  }, []);

  // Define fetchSessionDetails function
  const fetchSessionDetails = useCallback(async () => {
    if (!sessionId) {
      setError("Session ID is missing");
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      console.log("Fetching session details for ID:", sessionId);
      const response = await fetch(`/api/sessions/${sessionId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error response:", errorText);
        throw new Error(`Failed to fetch session: ${response.status} - ${errorText}`);
      }
      
      const data = await response.json();
      console.log("Session data received:", data ? "Success" : "Empty data");
      setSession(data);
      
      // Initialize verification fields based on trip details
      if (data.tripDetails) {
        const initialFields: Record<string, any> = {};
        
        Object.entries(data.tripDetails).forEach(([key, value]) => {
          if (value && typeof value === 'string' && value.trim() !== '') {
            initialFields[key] = {
              operatorValue: value,
              isVerified: false,
              matches: true,
              comment: ""
            };
          }
        });
        
        setVerificationFields(initialFields);
      }
      
      // Check edit permissions
      setCanEdit(data.status === SessionStatus.PENDING && 
                (data.createdBy?.id === authSession?.user?.id || 
                 userRole === "ADMIN" || userRole === "SUPERADMIN"));
    } catch (error) {
      console.error("Error fetching session:", error);
      setError("Failed to load session details. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [sessionId, authSession, userRole]);
  
  // Function to handle seal scanning
  const handleScanSeal = async (sealId: string) => {
    try {
      if (!sealId) return;
      
      // Check if this seal is already scanned
      if (scannedSealIds.has(sealId)) {
        toast(`Seal ${sealId} has already been scanned.`, { 
          icon: '🔵',
          duration: 3000
        });
        return;
      }
      
      // Mark as scanned
      const newScannedSealIds = new Set(scannedSealIds);
      newScannedSealIds.add(sealId);
      setScannedSealIds(newScannedSealIds);
      
      // Update status to VERIFIED
      const statusUpdate: SealStatusUpdate = {
        sealId,
        status: SealStatus.VERIFIED
      };
      
      setSealStatusUpdates({
        ...sealStatusUpdates,
        [sealId]: statusUpdate
      });
      
      // Find the seal in our existing data
      const existingSeal = sessionSeals?.find(seal => seal.barcode === sealId);
      
      if (existingSeal) {
        // Update API
        await updateSealStatus(existingSeal.id, SealStatus.VERIFIED);
        
        // Refresh seals data
        await fetchSessionSeals();
        
        toast.success(`Seal ${sealId} verified successfully!`);
      } else {
        toast.error(`Seal ${sealId} not found in this session.`);
      }
    } catch (error) {
      console.error("Error scanning seal:", error);
      toast.error("Failed to scan seal. Please try again.");
    }
  };
  
  // Function to open status dialog for a seal
  const openStatusDialog = (seal: any) => {
    setSelectedSealForStatus(seal);
    setStatusComment('');
    setStatusEvidence({ photos: [] });
    setStatusDialogOpen(true);
  };
  
  // Function to update seal status
  const updateSealStatus = async (sealId: string, status: string, comment?: string, evidence?: SealStatusEvidence) => {
    try {
      setIsSubmittingStatus(true);
      
      const response = await fetch(`/api/sessions/${sessionId}/seals/${sealId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status,
          comment,
          evidence
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update seal status');
      }
      
      const data = await response.json();
      
      // Update our state
      const newStatusUpdates = { ...sealStatusUpdates };
      newStatusUpdates[sealId] = {
        sealId,
        status,
        comment,
        evidence
      };
      setSealStatusUpdates(newStatusUpdates);
      
      return data.seal;
    } catch (error) {
      console.error("Error updating seal status:", error);
      throw error;
    } finally {
      setIsSubmittingStatus(false);
    }
  };
  
  // Function to handle photo upload for status evidence
  const handlePhotoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;
    
    const file = event.target.files[0];
    const reader = new FileReader();
    
    reader.onloadend = () => {
      const base64String = reader.result as string;
      setStatusEvidence({
        ...statusEvidence,
        photos: [...(statusEvidence.photos || []), base64String]
      });
    };
    
    reader.readAsDataURL(file);
  };
  
  // Function to handle status update submission
  const handleStatusUpdateSubmit = async () => {
    if (!selectedSealForStatus) return;
    
    try {
      // Validate evidence for BROKEN and TAMPERED statuses
      if (
        (selectedSealForStatus.status === SealStatus.BROKEN || 
         selectedSealForStatus.status === SealStatus.TAMPERED) && 
        (!statusEvidence.photos || statusEvidence.photos.length === 0)
      ) {
        toast.error(`Evidence photos are required for ${selectedSealForStatus.status} status.`);
        return;
      }
      
      await updateSealStatus(
        selectedSealForStatus.id,
        selectedSealForStatus.status,
        statusComment,
        statusEvidence
      );
      
      toast.success(`Seal status updated to ${selectedSealForStatus.status}.`);
      setStatusDialogOpen(false);
      
      // Refresh seals data
      await fetchSessionSeals();
    } catch (error) {
      toast.error(`Failed to update seal status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // Function to complete verification
  const completeVerification = async () => {
    try {
      setCompletingVerification(true);
      
      // Get all unscanned seal IDs with null/undefined checks
      const safeSessionSeals = sessionSeals || [];
      
      // Safely filter and map only if objects have the required properties
      const allSealTagIds = safeSessionSeals
        .filter(seal => seal && seal.type === 'tag' && seal.barcode)
        .map(seal => seal.barcode);
      
      // Filter out already scanned seal IDs
      const unscannedSealTagIds = allSealTagIds.filter(id => !scannedSealIds.has(id));
      setUnscannedSealIds(unscannedSealTagIds);
      
      // Count seals by status with safe checks
      const verifiedCount = safeSessionSeals.filter(seal => seal && seal.status === SealStatus.VERIFIED).length;
      const brokenCount = safeSessionSeals.filter(seal => seal && seal.status === SealStatus.BROKEN).length;
      const tamperedCount = safeSessionSeals.filter(seal => seal && seal.status === SealStatus.TAMPERED).length;
      
      // Show verification summary first
      setVerificationSummary({
        totalSeals: allSealTagIds.length,
        scannedSeals: scannedSealIds.size,
        unscannedSeals: unscannedSealTagIds.length,
        statusBreakdown: {
          [SealStatus.VERIFIED]: verifiedCount,
          [SealStatus.BROKEN]: brokenCount,
          [SealStatus.TAMPERED]: tamperedCount,
          [SealStatus.MISSING]: unscannedSealTagIds.length // These will be marked as MISSING
        }
      });
      
      console.log("Verification summary prepared:", {
        totalSeals: allSealTagIds.length,
        scannedSeals: scannedSealIds.size,
        unscannedSeals: unscannedSealTagIds.length,
        verifiedCount,
        brokenCount,
        tamperedCount
      });
      
      setVerificationSummaryOpen(true);
    } catch (error) {
      console.error("Error preparing verification summary:", error);
      toast.error("Failed to prepare verification summary. Please try again.");
      setCompletingVerification(false);
    }
  };
  
  // Function to confirm and complete verification
  const confirmAndCompleteVerification = async () => {
    try {
      // Close the summary dialog
      setVerificationSummaryOpen(false);
      
      // Complete verification via API
      const response = await fetch(`/api/sessions/${sessionId}/complete-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          verificationData: {
            scannedSealIds: Array.from(scannedSealIds),
            statusUpdates: sealStatusUpdates
          },
          unscannedSealTagIds: unscannedSealIds
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to complete verification');
      }
      
      const data = await response.json();
      
      toast.success("Verification completed successfully!");
      
      // Refresh session data
      await fetchSessionDetails();
      await fetchSessionSeals();
    } catch (error) {
      console.error("Error completing verification:", error);
      toast.error(`Failed to complete verification: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCompletingVerification(false);
    }
  };
  
  // Add a function to fetch all seals for this session
  const fetchSessionSeals = useCallback(async () => {
    if (!sessionId) {
      setSealsError("Session ID is missing");
      setLoadingSeals(false);
      return;
    }
    
    setLoadingSeals(true);
    try {
      console.log("Fetching seals for session:", sessionId);
      const response = await fetch(`/api/sessions/${sessionId}/seals`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error("API error fetching seals:", errorText);
        throw new Error(`Failed to fetch seals: ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      console.log("Session seals received:", data ? "Success" : "Empty data");
      setSessionSeals(data || []);
    } catch (error) {
      console.error('Error fetching seals:', error);
      setSealsError('Failed to fetch seals');
    } finally {
      setLoadingSeals(false);
    }
  }, [sessionId]);

  // Add useEffect to fetch session seals when session is loaded
  useEffect(() => {
    if (session) {
      fetchSessionSeals();
    }
  }, [session, fetchSessionSeals]);

  // Add useEffect to fetch session details when component mounts
  useEffect(() => {
    console.log("Component mounted, fetching session details...");
    fetchSessionDetails();
  }, [fetchSessionDetails]);
  
  // Add useEffect to extract verification data from session when it's loaded
  useEffect(() => {
    if (session && session.status === SessionStatus.COMPLETED) {
      console.log("Extracting verification data from completed session");
      
      // Look for verification data in activity logs or seal
      let foundVerificationData = false;
      
      // First check if there are any activity logs with verification data
      if (session.activityLogs && session.activityLogs.length > 0) {
        const verificationLog = session.activityLogs.find(log => {
          const details = log.details as any;
          return details?.verification?.fieldVerifications;
        });
        
        if (verificationLog && verificationLog.details) {
          console.log("Found verification data in activity log");
          const verificationDetails = (verificationLog.details as any).verification;
          
          if (verificationDetails && verificationDetails.fieldVerifications) {
            // Process verification data
            const fieldVerifications = verificationDetails.fieldVerifications;
            
            const matches: string[] = [];
            const mismatches: string[] = [];
            const unverified: string[] = [];
            const allFields: Record<string, any> = {};
            
            // Process each field
            Object.entries(fieldVerifications).forEach(([field, data]: [string, any]) => {
              allFields[field] = data;
              
              if (data.isVerified) {
                if (data.matches) {
                  matches.push(field);
                } else {
                  mismatches.push(field);
                }
              } else {
                unverified.push(field);
              }
            });
            
            // Set verification results
            setVerificationResults({
              matches,
              mismatches,
              unverified,
              allFields,
              timestamp: verificationDetails.verificationTimestamp || verificationLog.createdAt || new Date().toISOString()
            });
            
            foundVerificationData = true;
          }
        }
      }
      
      // If no data in activity logs, check seal verificationData
      if (!foundVerificationData && session.seal?.verificationData) {
        console.log("Found verification data in seal");
        const verificationData = session.seal.verificationData;
        
        if (verificationData.fieldVerifications) {
          // Process verification data
          const fieldVerifications = verificationData.fieldVerifications;
          
          const matches: string[] = [];
          const mismatches: string[] = [];
          const unverified: string[] = [];
          const allFields: Record<string, any> = {};
          
          // Process each field
          Object.entries(fieldVerifications).forEach(([field, data]: [string, any]) => {
            allFields[field] = data;
            
            if (data.isVerified) {
              if (data.matches) {
                matches.push(field);
              } else {
                mismatches.push(field);
              }
            } else {
              unverified.push(field);
            }
          });
          
          // Set verification results
          setVerificationResults({
            matches,
            mismatches,
            unverified,
            allFields,
            timestamp: verificationData.verificationTimestamp || session.seal.scannedAt || new Date().toISOString()
          });
          
          foundVerificationData = true;
        }
      }
      
      // Check system seals for verification data if we haven't found any yet
      if (!foundVerificationData && sessionSeals && sessionSeals.length > 0) {
        console.log("Looking for verification data in session seals");
        
        // Find the first verification seal with verification details
        const verificationSeal = sessionSeals.find(seal => 
          seal.verificationDetails && seal.verificationDetails.fieldVerifications
        );
        
        if (verificationSeal && verificationSeal.verificationDetails) {
          console.log("Found verification data in session seal");
          const verificationDetails = verificationSeal.verificationDetails;
          
          if (verificationDetails.fieldVerifications) {
            // Process verification data
            const fieldVerifications = verificationDetails.fieldVerifications;
            
            const matches: string[] = [];
            const mismatches: string[] = [];
            const unverified: string[] = [];
            const allFields: Record<string, any> = {};
            
            // Process each field
            Object.entries(fieldVerifications).forEach(([field, data]: [string, any]) => {
              allFields[field] = data;
              
              if (data.isVerified) {
                if (data.matches) {
                  matches.push(field);
                } else {
                  mismatches.push(field);
                }
              } else {
                unverified.push(field);
              }
            });
            
            // Set verification results
            setVerificationResults({
              matches,
              mismatches,
              unverified,
              allFields,
              timestamp: verificationDetails.verificationTimestamp || verificationSeal.scannedAt || new Date().toISOString()
            });
            
            foundVerificationData = true;
          }
        }
      }
      
      if (!foundVerificationData) {
        console.log("No verification data found for completed session");
      }
    }
  }, [session, sessionSeals]);
  
  // Function to render the seal status badge
  const renderSealStatusBadge = (status: string | null | undefined) => {
    if (!status) return null;
    
    switch (status) {
      case SealStatus.VERIFIED:
        return (
          <Chip 
            icon={<CheckCircle fontSize="small" />} 
            label="Verified" 
            color="success" 
            size="small" 
            variant="outlined"
          />
        );
      case SealStatus.MISSING:
        return (
          <Chip 
            icon={<Close fontSize="small" />} 
            label="Missing" 
            color="error" 
            size="small" 
            variant="outlined"
          />
        );
      case SealStatus.BROKEN:
        return (
          <Chip 
            icon={<Warning fontSize="small" />} 
            label="Broken" 
            color="warning" 
            size="small" 
            variant="outlined"
          />
        );
      case SealStatus.TAMPERED:
        return (
          <Chip 
            icon={<Warning fontSize="small" />} 
            label="Tampered" 
            color="error" 
            size="small" 
            variant="outlined"
          />
        );
      default:
        return (
          <Chip 
            label={status} 
            size="small" 
            variant="outlined"
          />
        );
    }
  };

  // Extract operator seals from session data - pulling from activity logs and sessionSeals
  const operatorSeals = useMemo(() => {
    if (!session) return [];
    
    const seals: Array<{
      id: string;
      method: string;
      image: string | null;
      timestamp: string;
    }> = [];
    
    // First try to get seals from the sessionSeals array (preferred source)
    if (sessionSeals && sessionSeals.length > 0) {
      // Use only tag type seals
      const tagSeals = sessionSeals.filter(seal => seal.type === 'tag');
      
      console.log("Found tag seals in sessionSeals:", tagSeals.length);
      
      tagSeals.forEach(seal => {
        seals.push({
          id: seal.barcode,
          method: seal.method || 'manual',
          image: null, // Images not available in this data structure
          timestamp: seal.createdAt
        });
      });
    }
    
    // If we couldn't find any seals in sessionSeals, try activity logs as fallback
    if (seals.length === 0 && session.activityLogs && session.activityLogs.length > 0) {
      console.log("No seals found in sessionSeals, trying activity logs");
      
      // Find the activity log that contains the seal tag information - usually from session creation
      const sealTagLog = session.activityLogs.find(log => {
        if (!log.details) return false;
        
        const details = log.details as any;
        // Check different possible paths to find seal tag data
        return (
          details.imageBase64Data?.sealTagImages || 
          details.sealTagIds || 
          details.tripDetails?.sealTagIds
        );
      });
      
      if (sealTagLog && sealTagLog.details) {
        const details = sealTagLog.details as any;
        let sealTagIds: string[] = [];
        let sealTagMethods: Record<string, string> = {};
        let sealTagImages: Record<string, string> = {};
        
        // Find sealTagIds from different possible locations in the data structure
        if (details.sealTagIds) {
          sealTagIds = typeof details.sealTagIds === 'string' ? 
            JSON.parse(details.sealTagIds) : details.sealTagIds;
        } else if (details.tripDetails?.sealTagIds) {
          sealTagIds = details.tripDetails.sealTagIds;
        } else if (details.imageBase64Data?.sealTagImages) {
          sealTagIds = Object.keys(details.imageBase64Data.sealTagImages);
        }
        
        // Get methods information if available
        if (details.sealTagMethods) {
          sealTagMethods = typeof details.sealTagMethods === 'string' ? 
            JSON.parse(details.sealTagMethods) : details.sealTagMethods;
        } else if (details.tripDetails?.sealTagMethods) {
          sealTagMethods = details.tripDetails.sealTagMethods;
        } else if (details.imageBase64Data?.sealTagImages) {
          // Extract methods from the image data
          Object.entries(details.imageBase64Data.sealTagImages).forEach(([id, data]: [string, any]) => {
            sealTagMethods[id] = data.method || 'unknown';
          });
        }
        
        // Get images from the session data if possible
        if (session.images?.sealingImages && session.images.sealingImages.length > 0) {
          // Associate images with seal tags if possible
          sealTagIds.forEach((id, index) => {
            if (index < session.images!.sealingImages!.length) {
              sealTagImages[id] = session.images!.sealingImages![index];
            }
          });
        }
        
        // Create the seals array from the collected data
        sealTagIds.forEach(id => {
          seals.push({
            id,
            method: sealTagMethods[id] || 'unknown',
            image: sealTagImages[id] || null,
            timestamp: sealTagLog.createdAt || session.createdAt
          });
        });
      }
    }
    
    // If we couldn't find any seals, check if session.tripDetails has seal tag information
    if (seals.length === 0 && session.tripDetails) {
      console.log("Checking tripDetails for seal tag information");
      
      // Access tripDetails and try to extract seal tag information if it exists
      const tripDetails = session.tripDetails as any;
      
      if (tripDetails.sealTagIds) {
        // If sealTagIds is available directly in tripDetails
        const sealTagIds = Array.isArray(tripDetails.sealTagIds) ? 
          tripDetails.sealTagIds : 
          (typeof tripDetails.sealTagIds === 'string' ? 
            JSON.parse(tripDetails.sealTagIds) : []);
        
        sealTagIds.forEach((id: string) => {
          seals.push({
            id,
            method: 'manual',
            image: null,
            timestamp: session.createdAt
          });
        });
      }
    }
    
    // Add console log to help debug the issue
    console.log("Extracted operator seals:", seals.length, seals);
    
    return seals;
  }, [session, sessionSeals]);

  // Update seal comparison data
  const updateSealComparison = useCallback((scannedSeals: any[]) => {
    const guardSealIds = scannedSeals.map(seal => seal.id.trim());
    const operatorSealIds = operatorSeals?.map(seal => seal.id.trim()) || [];
    
    console.log('Guard Seal IDs:', guardSealIds);
    console.log('Operator Seal IDs:', operatorSealIds);
    
    // Use normalized strings for comparison (trim and lowercase)
    const matched = guardSealIds.filter(id => 
      operatorSealIds.some(opId => opId.toLowerCase() === id.toLowerCase())
    );
    
    const mismatched = guardSealIds.filter(id => 
      !operatorSealIds.some(opId => opId.toLowerCase() === id.toLowerCase())
    );
    
    console.log('Matched Seal IDs:', matched);
    console.log('Mismatched Seal IDs:', mismatched);
    
    setSealComparison({ matched, mismatched });
  }, [operatorSeals]);

  // Input handlers
  const handleInputChange = useCallback((field: string, value: any) => {
    setVerificationFields(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        guardValue: value
      }
    }));
  }, []);

  const handleCommentChange = useCallback((field: string, comment: string) => {
    setVerificationFields(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        comment
      }
    }));
  }, []);

  // Handle field verification state toggle
  const verifyField = (field: string) => {
    setVerificationFields(prev => {
      const updatedFields = { ...prev };
      updatedFields[field] = {
        ...updatedFields[field],
        isVerified: !updatedFields[field].isVerified
      };
      return updatedFields;
    });
  };

  // Handle QR/barcode scanner input
  const handleScanComplete = useCallback((sealId: string) => {
    if (!sealId.trim()) {
      setScanError('Please enter a valid Seal Tag ID');
      return;
    }
    
    const trimmedSealId = sealId.trim();
    
    // Check if already scanned by guard
    if (guardScannedSeals.some(seal => seal.id.toLowerCase() === trimmedSealId.toLowerCase())) {
      setScanError('This seal has already been scanned');
      return;
    }
    
    // Check if this seal matches an operator seal (case insensitive)
    const isVerified = operatorSeals?.some(seal => 
      seal.id.trim().toLowerCase() === trimmedSealId.toLowerCase()
    ) || false;
    
    console.log('Scanning seal ID:', trimmedSealId);
    console.log('Operator seals:', operatorSeals?.map(s => s.id) || []);
    console.log('Is verified:', isVerified);
          
    // Add to scanned seals
    const newSeal = {
      id: trimmedSealId,
      method: scanMethod,
      image: null,
      imagePreview: null,
      timestamp: new Date().toISOString(),
      verified: isVerified
    };
    
    // Update state with the new seal
    const updatedSeals = [...guardScannedSeals, newSeal];
    setGuardScannedSeals(updatedSeals);
    setScanInput('');
    setScanError('');
    
    // Update comparison with the updated list
    updateSealComparison(updatedSeals);
    
    // Show success or warning message based on match
    if (isVerified) {
      console.log("Seal tag matched with operator seals");
    } else {
      console.log("Seal tag does not match any operator seals");
    }
  }, [guardScannedSeals, scanMethod, operatorSeals, updateSealComparison]);

  // Handle image upload for a seal
  const handleSealImageUpload = useCallback((index: number, file: File | null) => {
    if (!file) return;
    
    const updatedSeals = [...guardScannedSeals];
    updatedSeals[index].image = file;
    updatedSeals[index].imagePreview = URL.createObjectURL(file);
    setGuardScannedSeals(updatedSeals);
  }, [guardScannedSeals]);

  // Remove a scanned seal
  const removeSealTag = useCallback((index: number) => {
    const updatedSeals = [...guardScannedSeals];
    
    // Revoke object URL if exists to prevent memory leaks
    if (updatedSeals[index].imagePreview) {
      URL.revokeObjectURL(updatedSeals[index].imagePreview as string);
    }
    
    updatedSeals.splice(index, 1);
    setGuardScannedSeals(updatedSeals);
    
    // Update comparison
    updateSealComparison(updatedSeals);
  }, [guardScannedSeals, updateSealComparison]);
  
  // Check if user is a guard
  const isGuard = useMemo(() => 
    userRole === "EMPLOYEE" && userSubrole === EmployeeSubrole.GUARD, 
    [userRole, userSubrole]
  );
  
  // Add debug logging for key state variables
  useEffect(() => {
    console.log("Key state variables:", {
      sessionId,
      authStatus,
      userRole,
      userSubrole,
      isGuard,
      operatorSealsCount: operatorSeals?.length || 0,
      sessionStatus: session?.status
    });
  }, [sessionId, authStatus, userRole, userSubrole, isGuard, operatorSeals, session]);
  
  // Check if user can access reports (non-GUARD users)
  const canAccessReports = useMemo(() => 
    userRole === "SUPERADMIN" || 
    userRole === "ADMIN" || 
    userRole === "COMPANY", 
    [userRole]
  );
  
  // Check if the session can be verified - only using operator-entered seal tags
  const canVerify = useMemo(() => {
    console.log("Calculating canVerify:");
    console.log("- isGuard:", isGuard);
    console.log("- session status:", session?.status);
    console.log("- operator seals:", operatorSeals?.length || 0);
    
    // For debugging: log the raw values
    console.log("- userRole:", userRole);
    console.log("- userSubrole:", userSubrole);
    console.log("- EmployeeSubrole.GUARD:", EmployeeSubrole.GUARD);
    
    // Ensure all values are defined and meet conditions
    const hasValidGuardRole = isGuard === true;
    const hasValidSessionStatus = session?.status === SessionStatus.IN_PROGRESS;
    const hasOperatorSeals = (operatorSeals?.length || 0) > 0;
    const hasSealBarcode = !!session?.seal?.barcode;
    
    console.log("- hasValidGuardRole:", hasValidGuardRole);
    console.log("- hasValidSessionStatus:", hasValidSessionStatus);
    console.log("- hasOperatorSeals:", hasOperatorSeals);
    console.log("- hasSealBarcode:", hasSealBarcode);
    
    return hasValidGuardRole && 
      hasValidSessionStatus && 
      (hasOperatorSeals || hasSealBarcode);
  }, [isGuard, session, operatorSeals]);
  
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

  // Add useEffect to get user role and subrole when auth session is available
  useEffect(() => {
    if (authStatus === "authenticated" && authSession?.user?.id) {
      // Fetch user role and subrole
      console.log("Fetching user role for user ID:", authSession.user.id);
      
      // First try to use the role directly from the auth session if available
      if (authSession.user.role) {
        console.log("Using role from auth session:", authSession.user.role);
        setUserRole(authSession.user.role);
        
        // Also set subrole if available
        if (authSession.user.subrole) {
          console.log("Using subrole from auth session:", authSession.user.subrole);
          setUserSubrole(authSession.user.subrole);
        }
      }
      
      // Always fetch from API as well to ensure we have the latest data
      fetch(`/api/users/${authSession.user.id}/role`)
        .then(response => {
          console.log("Role API response status:", response.status);
          if (!response.ok) {
            throw new Error(`Failed to fetch role: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          console.log("User role data received:", data);
          setUserRole(data.role || "");
          setUserSubrole(data.subrole || "");
          
          // Log if this is a guard for debugging
          const isThisGuard = data.role === "EMPLOYEE" && data.subrole === EmployeeSubrole.GUARD;
          console.log("Is this user a GUARD?", isThisGuard);
          console.log("EmployeeSubrole.GUARD value:", EmployeeSubrole.GUARD);
          
          // Check if operator seals exist
          console.log("Operator seals count:", operatorSeals.length);
          console.log("Session status:", session?.status);
          
          // Calculate canVerify manually for debugging
          const shouldCanVerify = isThisGuard && 
            session?.status === SessionStatus.IN_PROGRESS && 
            (operatorSeals.length > 0 || session?.seal?.barcode);
          console.log("Should canVerify be true?", shouldCanVerify);
        })
        .catch(error => {
          console.error("Error fetching user role:", error);
        });
    } else if (authStatus === "unauthenticated") {
      console.log("User is not authenticated");
      setUserRole("");
      setUserSubrole("");
    }
  }, [authStatus, authSession?.user?.id, session, operatorSeals]);

  // Add useEffect to fetch session details when component mounts
  useEffect(() => {
    console.log("Component mounted, fetching session details...");
      fetchSessionDetails();
  }, [fetchSessionDetails]);
  
  // Add useEffect to fetch seals when session details are loaded
  useEffect(() => {
    if (session) {
      fetchSessionSeals();
    }
  }, [session, fetchSessionSeals]);
  
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
  
  // Handle image verification status toggle
  const verifyImage = (imageKey: string) => {
    setImageVerificationStatus(prev => ({
      ...prev,
      [imageKey]: !prev[imageKey]
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
  
  // Modified version of handleVerifySeal to allow completion without a seal barcode
  const handleVerifySeal = async () => {
    try {
      setVerifying(true);
      setError(""); // Clear any previous error
      
      // Upload any guard images that were provided
      const uploadedImageUrls: Record<string, any> = {};
      
      // Calculate verification results for each field
      const fieldVerificationResults = Object.entries(verificationFields).reduce(
        (results, [field, data]) => {
          results[field] = {
            operatorValue: data.operatorValue,
            guardValue: data.operatorValue, // Use operator value as the guard value
            matches: true, // Always match since we're just verifying
            comment: data.comment,
            isVerified: data.isVerified
          };
          return results;
        },
        {} as Record<string, any>
      );
      
      // If session has a seal, update it, otherwise create a new one
      let response;
      let retryCount = 0;
      const maxRetries = 2;
      
      while (retryCount <= maxRetries) {
        try {
          if (session?.seal?.id) {
            response = await fetch("/api/seals", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ 
              sealId: session.seal.id,
              verificationData: {
                fieldVerifications: fieldVerificationResults,
                guardImages: uploadedImageUrls,
                sealBarcode: sealInput || null,
                allMatch: true, // Always match since we're just verifying
                verificationTimestamp: new Date().toISOString()
              }
            }),
          });
          } else if (session) {
            // Create a new seal for this session
            response = await fetch("/api/seals", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ 
                sessionId: session.id,
                verificationData: {
                  fieldVerifications: fieldVerificationResults,
                  guardImages: uploadedImageUrls,
                  sealBarcode: sealInput || null,
                  allMatch: true, // Always match since we're just verifying
                  verificationTimestamp: new Date().toISOString()
                }
              }),
            });
          }
          
          // If we got a response, break out of the retry loop
          if (response) break;
        } catch (fetchError) {
          console.error(`Fetch attempt ${retryCount + 1} failed:`, fetchError);
          // If this was our last retry, throw the error to be caught by the outer try/catch
          if (retryCount === maxRetries) throw fetchError;
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        retryCount++;
      }
      
      if (!response) {
        throw new Error("Failed to connect to the server after multiple attempts");
      }
      
      let responseData;
      try {
        responseData = await response.json();
      } catch (jsonError) {
        console.error("Failed to parse response JSON:", jsonError);
      }
      
      if (!response.ok) {
        // Check if we have detailed error information
        const errorMessage = responseData?.error || 
          `Server returned error (${response.status}): ${response.statusText}`;
        throw new Error(errorMessage);
      }
      
      // Success! Update the UI
      setVerificationSuccess(true);
      setVerificationFormOpen(false);
      
      // If email sending failed but verification succeeded, show a warning
      if (responseData && responseData.emailSent === false) {
        console.warn("Verification completed but email notification failed:", responseData.emailError);
      }
      
      // Save verification results for displaying matched/mismatched fields
      const matches = Object.entries(fieldVerificationResults)
        .filter(([_, data]) => data.matches && data.isVerified)
        .map(([field, _]) => field);
      
      const mismatches = Object.entries(fieldVerificationResults)
        .filter(([_, data]) => !data.matches && data.isVerified)
        .map(([field, _]) => field);
      
      const unverified = Object.entries(fieldVerificationResults)
        .filter(([_, data]) => !data.isVerified)
        .map(([field, _]) => field);
        
      // Set state for displaying verification results
      setVerificationResults({
        matches,
        mismatches,
        unverified,
        allFields: fieldVerificationResults,
        timestamp: new Date().toISOString()
      });
      
      // Reload session data to update status
      setTimeout(() => {
        fetchSessionDetails();
      }, 1000);
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

  // Handle file uploads
  const handleImageUpload = (imageType: string, file: File | FileList | null) => {
    if (!file) return;

    // Handle single file uploads
    if (file instanceof File) {
      setGuardImages(prev => ({
        ...prev,
        [imageType]: file
      }));
      
      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      setImagePreviews(prev => ({
        ...prev,
        [imageType]: previewUrl
      }));
      
      // Mark as "verified" for progress tracking
      setImageVerificationStatus(prev => ({
        ...prev,
        [imageType]: true
      }));
      
    } 
    // Handle multiple file uploads
    else if (file instanceof FileList) {
      const fileArray = Array.from(file);
      
      setGuardImages(prev => ({
        ...prev,
        [imageType]: [...(prev[imageType as keyof typeof prev] as File[] || []), ...fileArray]
      }));
      
      // Create preview URLs
      const previewUrls = fileArray.map(f => URL.createObjectURL(f));
      setImagePreviews(prev => ({
        ...prev,
        [imageType]: [...(prev[imageType as keyof typeof prev] as string[] || []), ...previewUrls]
      }));
      
      // Mark as "verified" for progress tracking
      setImageVerificationStatus(prev => ({
        ...prev,
        [imageType]: true
      }));
    }
  };

  // Remove uploaded image
  const removeUploadedImage = (imageType: string, index?: number) => {
    // For single images
    if (index === undefined) {
      setGuardImages(prev => ({
        ...prev,
        [imageType]: null
      }));
      
      // Revoke preview URL to prevent memory leaks
      if (imagePreviews[imageType as keyof typeof imagePreviews]) {
        URL.revokeObjectURL(imagePreviews[imageType as keyof typeof imagePreviews] as string);
      }
      
      setImagePreviews(prev => ({
        ...prev,
        [imageType]: undefined
      }));
      
      // Update verification status
      setImageVerificationStatus(prev => ({
        ...prev,
        [imageType]: false
      }));
    } 
    // For multiple images
    else if (typeof index === 'number') {
      const currentFiles = guardImages[imageType as keyof typeof guardImages] as File[] || [];
      const currentPreviews = imagePreviews[imageType as keyof typeof imagePreviews] as string[] || [];
      
      // Revoke preview URL
      if (currentPreviews[index]) {
        URL.revokeObjectURL(currentPreviews[index]);
      }
      
      // Remove file and preview
      const newFiles = [...currentFiles];
      newFiles.splice(index, 1);
      
      const newPreviews = [...currentPreviews];
      newPreviews.splice(index, 1);
      
      setGuardImages(prev => ({
        ...prev,
        [imageType]: newFiles
      }));
      
      setImagePreviews(prev => ({
        ...prev,
        [imageType]: newPreviews
      }));
      
      // Update verification status if all images are removed
      if (newFiles.length === 0) {
        setImageVerificationStatus(prev => ({
          ...prev,
          [imageType]: false
        }));
      }
    }
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
          Loading Details Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Please verify the loading details by comparing physical documents and vehicle information.
        </Typography>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'background.paper' }}>
                <TableCell width="40%"><strong>Field</strong></TableCell>
                <TableCell width="45%"><strong>Operator Value</strong></TableCell>
                <TableCell width="15%"><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(verificationFields)
                .filter(([field, _]) => [
                  'transporterName', 'materialName', 'receiverPartyName', 'vehicleNumber',
                  'registrationCertificate', 'gpsImeiNumber', 'cargoType', 'loadingSite',
                  'loaderName', 'challanRoyaltyNumber', 'doNumber', 'freight',
                  'qualityOfMaterials', 'numberOfPackages', 'tpNumber', 'grossWeight',
                  'tareWeight', 'netMaterialWeight', 'loaderMobileNumber'
                ].includes(field))
                .map(([field, data]) => (
                  <TableRow key={field} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell component="th" scope="row">
                      {getFieldLabel(field)}
                    </TableCell>
                    <TableCell>
                      {data.operatorValue}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" flexDirection="column" alignItems="center">
                        <IconButton 
                          onClick={() => verifyField(field)}
                          color={data.isVerified ? "success" : "default"}
                          size="small"
                        >
                          {data.isVerified ? <CheckCircle /> : <RadioButtonUnchecked />}
                        </IconButton>
                        <TextField
                          size="small"
                          placeholder="Add comment"
                          value={data.comment}
                          onChange={(e) => handleCommentChange(field, e.target.value)}
                          variant="standard"
                          sx={{ mt: 1, width: '100%' }}
                          InputProps={{
                            endAdornment: data.comment ? (
                              <InputAdornment position="end">
                                <IconButton 
                                  onClick={() => handleCommentChange(field, '')}
                                  edge="end"
                                  size="small" 
                                >
                                  <Close fontSize="small" />
                                </IconButton>
                              </InputAdornment>
                            ) : null,
                          }}
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  // Driver Details Verification
  const renderDriverDetailsVerification = () => {
    if (!session || !session.tripDetails) {
      return (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No driver details available for verification.
          </Typography>
        </Box>
      );
    }

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Driver Details Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Please verify the driver's details and documents. Cross-check with physical license and identification.
        </Typography>

        <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: 'background.paper' }}>
                <TableCell width="40%"><strong>Field</strong></TableCell>
                <TableCell width="45%"><strong>Operator Value</strong></TableCell>
                <TableCell width="15%"><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(verificationFields)
                .filter(([field, _]) => [
                  'driverName', 'driverMobileNumber', 'driverLicenseNumber',
                  'driverLicenseExpiryDate', 'driverAddress', 'driverExperience'
                ].includes(field))
                .map(([field, data]) => (
                  <TableRow key={field} sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                    <TableCell component="th" scope="row">
                      {getFieldLabel(field)}
                    </TableCell>
                    <TableCell>
                      {data.operatorValue}
                    </TableCell>
                    <TableCell>
                      <Box display="flex" flexDirection="column" alignItems="center">
                        <IconButton 
                          onClick={() => verifyField(field)}
                          color={data.isVerified ? "success" : "default"}
                          size="small"
                        >
                          {data.isVerified ? <CheckCircle /> : <RadioButtonUnchecked />}
                        </IconButton>
                        <TextField
                          size="small"
                          placeholder="Add comment"
                          value={data.comment}
                          onChange={(e) => handleCommentChange(field, e.target.value)}
                          variant="standard"
                          sx={{ mt: 1, width: '100%' }}
                          InputProps={{
                            endAdornment: data.comment ? (
                              <InputAdornment position="end">
                                <IconButton 
                                  onClick={() => handleCommentChange(field, '')}
                                  edge="end"
                                  size="small" 
                                >
                                  <Close fontSize="small" />
                                </IconButton>
                              </InputAdornment>
                            ) : null,
                          }}
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Driver's photo verification */}
        <Box sx={{ mt: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Driver's Photo Verification
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Original driver photo */}
            {session.images?.driverPicture && (
              <Box sx={{ width: '150px' }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Driver photo:
                </Typography>
                <Box sx={{ border: '1px solid #ddd', borderRadius: 1, overflow: 'hidden' }}>
                  <img 
                    src={session.images.driverPicture} 
                    alt="Driver" 
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                  />
                </Box>
              </Box>
            )}
            
            {/* Verification radio button and comment */}
            <Box sx={{ flex: 1 }}>
              <Box display="flex" alignItems="center">
                <IconButton 
                  onClick={() => verifyImage('driverPicture')}
                  color={imageVerificationStatus.driverPicture ? "success" : "default"}
                  size="small"
                >
                  {imageVerificationStatus.driverPicture ? <CheckCircle /> : <RadioButtonUnchecked />}
                </IconButton>
                <Typography variant="body2" sx={{ ml: 1 }}>
                  Mark as verified
                </Typography>
              </Box>
              <TextField
                fullWidth
                size="small"
                placeholder="Add comment"
                value={imageComments.driverPicture || ''}
                onChange={(e) => handleImageCommentChange('driverPicture', e.target.value)}
                variant="outlined"
                multiline
                rows={2}
                sx={{ mt: 2 }}
              />
            </Box>
          </Box>
        </Box>
      </Box>
    );
  };

  // Verification Form Step 2: Image Upload (formerly Image Verification)
  const renderImageVerification = () => {
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Image Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Please verify the images taken by the operator at source.
        </Typography>

        {/* Driver's Photo Verification */}
        {session?.images?.driverPicture && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Driver's Photo
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ width: '150px' }}>
                <img 
                  src={session.images.driverPicture} 
                  alt="Driver" 
                  style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box display="flex" alignItems="center">
                  <IconButton 
                    onClick={() => verifyImage('driverPicture')}
                    color={imageVerificationStatus.driverPicture ? "success" : "default"}
                    size="small"
                  >
                    {imageVerificationStatus.driverPicture ? <CheckCircle /> : <RadioButtonUnchecked />}
                  </IconButton>
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    Mark as verified
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Add comment"
                  value={imageComments.driverPicture || ''}
                  onChange={(e) => handleImageCommentChange('driverPicture', e.target.value)}
                  variant="outlined"
                  multiline
                  rows={2}
                  sx={{ mt: 2 }}
                />
              </Box>
            </Box>
          </Paper>
        )}

        {/* Vehicle Number Plate Verification */}
        {session?.images?.vehicleNumberPlatePicture && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Vehicle Number Plate
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ width: '150px' }}>
                <img 
                  src={session.images.vehicleNumberPlatePicture} 
                  alt="Vehicle Number Plate" 
                  style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box display="flex" alignItems="center">
                  <IconButton 
                    onClick={() => verifyImage('vehicleNumberPlatePicture')}
                    color={imageVerificationStatus.vehicleNumberPlatePicture ? "success" : "default"}
                    size="small"
                  >
                    {imageVerificationStatus.vehicleNumberPlatePicture ? <CheckCircle /> : <RadioButtonUnchecked />}
                  </IconButton>
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    Mark as verified
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Add comment"
                  value={imageComments.vehicleNumberPlatePicture || ''}
                  onChange={(e) => handleImageCommentChange('vehicleNumberPlatePicture', e.target.value)}
                  variant="outlined"
                  multiline
                  rows={2}
                  sx={{ mt: 2 }}
                />
              </Box>
            </Box>
          </Paper>
        )}

        {/* GPS IMEI Verification */}
        {session?.images?.gpsImeiPicture && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              GPS IMEI
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
              <Box sx={{ width: '150px' }}>
                <img 
                  src={session.images.gpsImeiPicture} 
                  alt="GPS IMEI" 
                  style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid #ddd', borderRadius: '4px' }}
                />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box display="flex" alignItems="center">
                  <IconButton 
                    onClick={() => verifyImage('gpsImeiPicture')}
                    color={imageVerificationStatus.gpsImeiPicture ? "success" : "default"}
                    size="small"
                  >
                    {imageVerificationStatus.gpsImeiPicture ? <CheckCircle /> : <RadioButtonUnchecked />}
                  </IconButton>
                  <Typography variant="body2" sx={{ ml: 1 }}>
                    Mark as verified
                  </Typography>
                </Box>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Add comment"
                  value={imageComments.gpsImeiPicture || ''}
                  onChange={(e) => handleImageCommentChange('gpsImeiPicture', e.target.value)}
                  variant="outlined"
                  multiline
                  rows={2}
                  sx={{ mt: 2 }}
                />
              </Box>
            </Box>
          </Paper>
        )}

        {/* Sealing Images Verification */}
        {session?.images?.sealingImages && session.images.sealingImages.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Sealing Images
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Box display="flex" alignItems="center">
                <IconButton 
                  onClick={() => verifyImage('sealingImages')}
                  color={imageVerificationStatus.sealingImages ? "success" : "default"}
                  size="small"
                >
                  {imageVerificationStatus.sealingImages ? <CheckCircle /> : <RadioButtonUnchecked />}
                </IconButton>
                <Typography variant="body2" sx={{ ml: 1 }}>
                  Mark all sealing images as verified
                </Typography>
              </Box>
              <TextField
                fullWidth
                size="small"
                placeholder="Add comment"
                value={imageComments.sealingImages || ''}
                onChange={(e) => handleImageCommentChange('sealingImages', e.target.value)}
                variant="outlined"
                multiline
                rows={2}
                sx={{ mt: 2, mb: 2 }}
              />
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {session.images.sealingImages.map((image, index) => (
                <Box key={`sealing-${index}`} sx={{ width: '150px' }}>
                  <img 
                    src={image} 
                    alt={`Sealing ${index + 1}`} 
                    style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </Box>
              ))}
            </Box>
          </Paper>
        )}

        {/* Vehicle Images Verification */}
        {session?.images?.vehicleImages && session.images.vehicleImages.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Vehicle Images
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Box display="flex" alignItems="center">
                <IconButton 
                  onClick={() => verifyImage('vehicleImages')}
                  color={imageVerificationStatus.vehicleImages ? "success" : "default"}
                  size="small"
                >
                  {imageVerificationStatus.vehicleImages ? <CheckCircle /> : <RadioButtonUnchecked />}
                </IconButton>
                <Typography variant="body2" sx={{ ml: 1 }}>
                  Mark all vehicle images as verified
                </Typography>
              </Box>
              <TextField
                fullWidth
                size="small"
                placeholder="Add comment"
                value={imageComments.vehicleImages || ''}
                onChange={(e) => handleImageCommentChange('vehicleImages', e.target.value)}
                variant="outlined"
                multiline
                rows={2}
                sx={{ mt: 2, mb: 2 }}
              />
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {session.images.vehicleImages.map((image, index) => (
                <Box key={`vehicle-${index}`} sx={{ width: '150px' }}>
                  <img 
                    src={image} 
                    alt={`Vehicle ${index + 1}`} 
                    style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </Box>
              ))}
            </Box>
          </Paper>
        )}

        {/* Additional Images Verification */}
        {session?.images?.additionalImages && session.images.additionalImages.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Additional Images
            </Typography>
            <Box sx={{ mb: 2 }}>
              <Box display="flex" alignItems="center">
                <IconButton 
                  onClick={() => verifyImage('additionalImages')}
                  color={imageVerificationStatus.additionalImages ? "success" : "default"}
                  size="small"
                >
                  {imageVerificationStatus.additionalImages ? <CheckCircle /> : <RadioButtonUnchecked />}
                </IconButton>
                <Typography variant="body2" sx={{ ml: 1 }}>
                  Mark all additional images as verified
                </Typography>
              </Box>
              <TextField
                fullWidth
                size="small"
                placeholder="Add comment"
                value={imageComments.additionalImages || ''}
                onChange={(e) => handleImageCommentChange('additionalImages', e.target.value)}
                variant="outlined"
                multiline
                rows={2}
                sx={{ mt: 2, mb: 2 }}
              />
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {session.images.additionalImages.map((image, index) => (
                <Box key={`additional-${index}`} sx={{ width: '150px' }}>
                  <img 
                    src={image} 
                    alt={`Additional ${index + 1}`} 
                    style={{ width: '100%', height: 'auto', display: 'block', border: '1px solid #ddd', borderRadius: '4px' }}
                  />
                </Box>
              ))}
            </Box>
          </Paper>
        )}
      </Box>
    );
  };

  // Seal Verification Component
  const renderSealVerification = () => {
    if (!session) {
      return (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            Loading session data...
          </Typography>
        </Box>
      );
    }

    // Check if no operator seals or QR codes are available
    if (operatorSeals.length === 0 && 
        (!session.qrCodes || (!session.qrCodes.primaryBarcode && 
         (!session.qrCodes.additionalBarcodes || session.qrCodes.additionalBarcodes.length === 0)))) {
      return (
        <Box sx={{ py: 3, textAlign: 'center' }}>
          <Typography variant="body1" color="text.secondary">
            No seal tag information available for verification. This session may have been created before seal tag scanning was implemented.
          </Typography>
        </Box>
      );
    }

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Seal Tags Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Verify the seal tags by scanning each seal's barcode/QR code. Each tag should match with those applied by the operator.
        </Typography>

        {/* OPERATOR Seal Tags Table */}
        <Paper variant="outlined" sx={{ p: 2, mb: 4, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <Typography variant="subtitle1" gutterBottom sx={{ color: 'primary.contrastText' }}>
            OPERATOR Seal Tags to Match ({operatorSeals.length})
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: 'primary.contrastText' }}>
            The following seal tags were registered by the operator. Scan or enter these exact tags to verify them.
          </Typography>
          
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead sx={{ bgcolor: 'primary.main' }}>
                <TableRow>
                  <TableCell sx={{ color: 'primary.contrastText' }}>#</TableCell>
                  <TableCell sx={{ color: 'primary.contrastText' }}>Seal Tag ID</TableCell>
                  <TableCell sx={{ color: 'primary.contrastText' }}>Method</TableCell>
                  <TableCell sx={{ color: 'primary.contrastText' }}>Registered On</TableCell>
                  <TableCell sx={{ color: 'primary.contrastText' }}>Image</TableCell>
                  <TableCell sx={{ color: 'primary.contrastText' }}>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {operatorSeals.map((seal, index) => {
                  // Check if this operator seal has been scanned by the guard
                  const isScanned = guardScannedSeals.some(
                    guardSeal => guardSeal.id.toLowerCase() === seal.id.toLowerCase()
                  );
                  
                  return (
                    <TableRow key={index} 
                      sx={{
                        bgcolor: isScanned ? 'success.light' : 'background.paper',
                        '&:hover': { bgcolor: isScanned ? 'success.light' : 'action.hover' }
                      }}
                    >
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2"
                          sx={{ 
                            fontWeight: 'medium',
                            fontFamily: 'monospace'
                          }}
                        >
                          {seal.id}
                        </Typography>
                        {isScanned && (
                          <Chip 
                            size="small" 
                            label="Verified" 
                            color="success"
                            icon={<CheckCircle fontSize="small" />}
                            sx={{ mt: 0.5 }}
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          size="small"
                          label={seal.method === 'digital' ? 'Scanned' : 'Manual'} 
                          color={seal.method === 'digital' ? 'info' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{new Date(seal.timestamp).toLocaleString()}</TableCell>
                      <TableCell>
                        {seal.image ? (
                          <Box sx={{ width: 60, height: 60 }}>
                            <img 
                              src={seal.image} 
                              alt={`Seal ${index + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
                            />
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            No image
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {isScanned ? (
                          <Chip 
                            size="small"
                            label="Scanned" 
                            color="success"
                            icon={<CheckCircle fontSize="small" />}
                          />
                        ) : (
                          <Chip 
                            size="small"
                            label="Not Scanned Yet" 
                            color="warning"
                            icon={<Warning fontSize="small" />}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Seal Scanner Section */}
        <Paper variant="outlined" sx={{ p: 2, mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Scan Seal Tags
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <TextField
                fullWidth
                size="small"
                variant="outlined"
                label="Seal Tag ID"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                error={!!scanError}
                helperText={scanError}
              />
              
              <Button 
                variant="contained" 
                onClick={() => handleScanComplete(scanInput)}
                disabled={!scanInput.trim()}
              >
                Add Manually
              </Button>
              
              <ClientSideQrScanner
                onScanWithImage={(data, imageFile) => {
                  // Set method to digital since this was scanned
                  setScanMethod('digital');
                  
                  const trimmedData = data.trim();
                  
                  // Check if already scanned by guard (case insensitive)
                  if (guardScannedSeals.some(seal => seal.id.toLowerCase() === trimmedData.toLowerCase())) {
                    setScanError('This seal has already been scanned');
                    setTimeout(() => setScanError(''), 3000);
                    return;
                  }
                  
                  // Check if this seal matches an operator seal (case insensitive)
                  const isVerified = operatorSeals.some(seal => 
                    seal.id.trim().toLowerCase() === trimmedData.toLowerCase()
                  );
                  
                  console.log('Scanning seal ID (QR):', trimmedData);
                  console.log('Operator seals:', operatorSeals.map(s => s.id));
                  console.log('Is verified:', isVerified);
                  
                  // Add the seal with the scanned data and captured image
                  const newSeal = {
                    id: trimmedData,
                    method: 'digital',
                    image: imageFile,
                    imagePreview: URL.createObjectURL(imageFile),
                    timestamp: new Date().toISOString(),
                    verified: isVerified
                  };
                  
                  // Update state with the new seal
                  const updatedSeals = [...guardScannedSeals, newSeal];
                  setGuardScannedSeals(updatedSeals);
                  
                  // Update comparison with the updated list
                  updateSealComparison(updatedSeals);
                  
                  // Show success or warning message based on match
                  if (isVerified) {
                    console.log("Seal tag matched with operator seals");
                  } else {
                    console.log("Seal tag does not match any operator seals");
                  }
                }}
                buttonText="Scan QR/Barcode"
                scannerTitle="Scan Seal Tag"
                buttonVariant="contained"
              />
            </Box>
          </Box>
        </Paper>

        {/* Scanned Seals Table */}
        <Paper variant="outlined" sx={{ p: 2, mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Scanned Seal Tags ({guardScannedSeals.length})
          </Typography>
          
          {guardScannedSeals.length > 0 ? (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width="5%">#</TableCell>
                    <TableCell width="25%">Seal Tag ID</TableCell>
                    <TableCell width="15%">Method</TableCell>
                    <TableCell width="20%">Timestamp</TableCell>
                    <TableCell width="20%">Image</TableCell>
                    <TableCell width="15%">Status</TableCell>
                    <TableCell width="10%">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {guardScannedSeals.map((seal, index) => (
                    <TableRow key={index} sx={{
                      bgcolor: seal.verified ? 'transparent' : 'rgba(211, 47, 47, 0.1)'
                    }}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{seal.id}</TableCell>
                      <TableCell>
                        <Chip 
                          size="small"
                          label={seal.method === 'digital' ? 'Scanned' : 'Manual'} 
                          color={seal.method === 'digital' ? 'info' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{new Date(seal.timestamp).toLocaleString()}</TableCell>
                      <TableCell>
                        {seal.imagePreview ? (
                          <Box sx={{ position: 'relative', width: 60, height: 60 }}>
                            <img 
                              src={seal.imagePreview} 
                              alt={`Seal ${index + 1}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
                            />
                          </Box>
                        ) : (
                          <Button
                            component="label"
                            variant="outlined"
                            size="small"
                            startIcon={<CloudUpload />}
                          >
                            Upload
                            <input
                              type="file"
                              hidden
                              accept="image/*"
                              onChange={(e) => handleSealImageUpload(index, e.target.files?.[0] || null)}
                            />
                          </Button>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          size="small"
                          label={seal.verified ? 'Matched' : 'Not Matched'} 
                          color={seal.verified ? 'success' : 'error'}
                          icon={seal.verified ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" color="error" onClick={() => removeSealTag(index)}>
                          <Delete fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box sx={{ py: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No seal tags scanned yet. Use the scanner above to add seal tags.
              </Typography>
            </Box>
          )}
        </Paper>

        {/* Verification Summary */}
        <Paper variant="outlined" sx={{ p: 2, mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Seal Tags Verification Summary
          </Typography>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
            <Box sx={{ flex: '1 0 48%', minWidth: '250px' }}>
              <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  <CheckCircle />
                  <Typography variant="h6">{sealComparison.matched.length} Matched Seal Tags</Typography>
                </Box>
              </Paper>
            </Box>
            <Box sx={{ flex: '1 0 48%', minWidth: '250px' }}>
              <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                  <Warning />
                  <Typography variant="h6">{sealComparison.mismatched.length} Mismatched Seal Tags</Typography>
                </Box>
              </Paper>
            </Box>
          </Box>

          {/* Comparison Table */}
          <Typography variant="subtitle2" gutterBottom>
            Detailed Comparison
          </Typography>
          
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'background.paper' }}>
                  <TableCell colSpan={3} align="center" sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)' }}>
                    <Typography variant="subtitle2">Operator Data</Typography>
                  </TableCell>
                  <TableCell colSpan={3} align="center">
                    <Typography variant="subtitle2">Guard Data</Typography>
                  </TableCell>
                  <TableCell rowSpan={2} align="center">
                    <Typography variant="subtitle2">Status</Typography>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Seal Tag ID</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)' }}>Timestamp</TableCell>
                  <TableCell>Seal Tag ID</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Timestamp</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* All operator seals */}
                {operatorSeals.map((operatorSeal, index) => {
                  const matchingGuardSeal = guardScannedSeals.find(
                    guardSeal => guardSeal.id === operatorSeal.id
                  );
                  
                  const isMatched = !!matchingGuardSeal;
                  
                  return (
                    <TableRow key={`operator-${index}`} sx={{
                      bgcolor: isMatched ? 'transparent' : 'rgba(211, 47, 47, 0.1)'
                    }}>
                      <TableCell>{operatorSeal.id}</TableCell>
                      <TableCell>
                        <Chip 
                          size="small"
                          label={operatorSeal.method === 'digital' ? 'Scanned' : 'Manual'} 
                          color={operatorSeal.method === 'digital' ? 'info' : 'default'}
                        />
                      </TableCell>
                      <TableCell sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)' }}>
                        {new Date(operatorSeal.timestamp).toLocaleString()}
                      </TableCell>
                      {matchingGuardSeal ? (
                        <>
                          <TableCell>{matchingGuardSeal.id}</TableCell>
                          <TableCell>
                            <Chip 
                              size="small"
                              label={matchingGuardSeal.method === 'digital' ? 'Scanned' : 'Manual'} 
                              color={matchingGuardSeal.method === 'digital' ? 'info' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(matchingGuardSeal.timestamp).toLocaleString()}
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell colSpan={3} align="center">
                            <Typography variant="body2" color="error">
                              Not scanned by guard
                            </Typography>
                          </TableCell>
                        </>
                      )}
                      <TableCell align="center">
                        <Chip 
                          size="small"
                          label={isMatched ? 'Matched' : 'Missing'} 
                          color={isMatched ? 'success' : 'error'}
                          icon={isMatched ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                
                {/* Guard seals not in operator list */}
                {guardScannedSeals
                  .filter(guardSeal => !operatorSeals.some(
                    operatorSeal => operatorSeal.id === guardSeal.id
                  ))
                  .map((guardSeal, index) => (
                    <TableRow key={`guard-only-${index}`} sx={{
                      bgcolor: 'rgba(211, 47, 47, 0.1)'
                    }}>
                      <TableCell colSpan={3} align="center" sx={{ borderRight: '1px solid rgba(224, 224, 224, 1)' }}>
                        <Typography variant="body2" color="error">
                          Not found in operator records
                        </Typography>
                      </TableCell>
                      <TableCell>{guardSeal.id}</TableCell>
                      <TableCell>
                        <Chip 
                          size="small"
                          label={guardSeal.method === 'digital' ? 'Scanned' : 'Manual'} 
                          color={guardSeal.method === 'digital' ? 'info' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        {new Date(guardSeal.timestamp).toLocaleString()}
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          size="small"
                          label="Extra" 
                          color="error"
                          icon={<Warning fontSize="small" />}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                }
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        {/* Side-by-side Image Comparison */}
        <Paper variant="outlined" sx={{ p: 2, mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Seal Images Comparison
          </Typography>
          
          {operatorSeals.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Seal Tag ID</TableCell>
                    <TableCell>Operator Image</TableCell>
                    <TableCell>Guard Image</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {operatorSeals.map((operatorSeal, index) => {
                    const matchingGuardSeal = guardScannedSeals.find(
                      guardSeal => guardSeal.id === operatorSeal.id
                    );
                    
                    return (
                      <TableRow key={`img-${index}`}>
                        <TableCell>{operatorSeal.id}</TableCell>
                        <TableCell>
                          {operatorSeal.image ? (
                            <Box sx={{ width: 120, height: 120 }}>
                              <img 
                                src={operatorSeal.image} 
                                alt={`Operator Seal ${operatorSeal.id}`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
                              />
                            </Box>
                          ) : (
                      <Typography variant="body2" color="text.secondary">
                              No image available
                      </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {matchingGuardSeal?.imagePreview ? (
                            <Box sx={{ width: 120, height: 120 }}>
                              <img 
                                src={matchingGuardSeal.imagePreview} 
                                alt={`Guard Seal ${matchingGuardSeal.id}`}
                                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
                              />
                    </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No image available
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No seal images available for comparison.
            </Typography>
                  )}
                </Paper>

        {/* Final Detailed Comparison Table */}
        <Paper variant="outlined" sx={{ p: 2, mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Complete Seal Verification Report
          </Typography>
          
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell rowSpan={2}>Seal Tag ID</TableCell>
                  <TableCell colSpan={3} align="center">Operator</TableCell>
                  <TableCell colSpan={3} align="center">Guard</TableCell>
                  <TableCell rowSpan={2}>Status</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>Method</TableCell>
                  <TableCell>Image</TableCell>
                  <TableCell>Timestamp</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Image</TableCell>
                  <TableCell>Timestamp</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {/* Combine all seal IDs from both operator and guard */}
                {[...new Set([
                  ...operatorSeals.map(seal => seal.id),
                  ...guardScannedSeals.map(seal => seal.id)
                ])].map((sealId, index) => {
                  const operatorSeal = operatorSeals.find(seal => seal.id === sealId);
                  const guardSeal = guardScannedSeals.find(seal => seal.id === sealId);
                  const isMatched = !!operatorSeal && !!guardSeal;
                  
                  return (
                    <TableRow key={`final-${index}`} sx={{
                      bgcolor: isMatched ? 'transparent' : 'rgba(211, 47, 47, 0.1)'
                    }}>
                      <TableCell>{sealId}</TableCell>
                      {/* Operator columns */}
                      {operatorSeal ? (
                        <>
                          <TableCell>
                            <Chip 
                              size="small"
                              label={operatorSeal.method === 'digital' ? 'Scanned' : 'Manual'} 
                              color={operatorSeal.method === 'digital' ? 'info' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            {operatorSeal.image ? (
                              <Box sx={{ width: 50, height: 50 }}>
                                <img 
                                  src={operatorSeal.image} 
                                  alt={`Operator Seal ${operatorSeal.id}`}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
                                />
            </Box>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                N/A
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(operatorSeal.timestamp).toLocaleString()}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell colSpan={3} align="center">
                          <Typography variant="body2" color="error">
                            Not in operator records
                          </Typography>
                        </TableCell>
                      )}
                      
                      {/* Guard columns */}
                      {guardSeal ? (
                        <>
                          <TableCell>
                            <Chip 
                              size="small"
                              label={guardSeal.method === 'digital' ? 'Scanned' : 'Manual'} 
                              color={guardSeal.method === 'digital' ? 'info' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            {guardSeal.imagePreview ? (
                              <Box sx={{ width: 50, height: 50 }}>
                                <img 
                                  src={guardSeal.imagePreview} 
                                  alt={`Guard Seal ${guardSeal.id}`}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
                                />
          </Box>
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                N/A
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(guardSeal.timestamp).toLocaleString()}
                          </TableCell>
                        </>
                      ) : (
                        <TableCell colSpan={3} align="center">
                          <Typography variant="body2" color="error">
                            Not scanned by guard
                          </Typography>
                        </TableCell>
                      )}
                      
                      <TableCell align="center">
                        <Chip 
                          size="small"
                          label={isMatched ? 'Matched' : operatorSeal ? 'Missing' : 'Extra'} 
                          color={isMatched ? 'success' : 'error'}
                          icon={isMatched ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    );
  };

  // Enhanced function to display verification results with color coding
  const renderVerificationResults = () => {
    if (!verificationResults || !session) return null;
    
    const { matches, mismatches, unverified, allFields, timestamp } = verificationResults;
    
    return (
      <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Trip Verification Results
        </Typography>
        
        <Alert severity="success" sx={{ mb: 3 }}>
          <AlertTitle>Verification Complete</AlertTitle>
          <Typography variant="body2">
            Verification was completed on {new Date(timestamp).toLocaleString()}
            {session.seal?.verifiedBy && ` by ${session.seal.verifiedBy.name}`}.
          </Typography>
        </Alert>
        
        {/* Seal verification information */}
        {session.seal && operatorSeals && operatorSeals.length > 0 && (
          <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="subtitle1" gutterBottom>Seal Information</Typography>
            
            <Typography variant="body2" sx={{ mb: 2 }}>
              Total Seal Tags: <strong>{operatorSeals.length}</strong>
                </Typography>
            
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>No.</TableCell>
                    <TableCell>Seal Tag ID</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Image</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {operatorSeals.map((seal, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{seal.id}</TableCell>
                      <TableCell>
                        <Chip 
                          label={seal.method === 'digital' ? "Scanned" : "Manual Entry"}
                          color="primary" 
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {seal.image ? (
                          <Box 
                            component="img" 
                            src={seal.image} 
                            alt={`Seal tag ${index+1}`}
                            sx={{ 
                              width: 60, 
                              height: 60, 
                              objectFit: 'cover',
                              borderRadius: 1,
                              cursor: 'pointer'
                            }}
                            onClick={() => {
                              // Open image in new tab
                              window.open(seal.image!, '_blank');
                            }}
                          />
                        ) : (
                          <Typography variant="caption">No image</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
      </Paper>
    );
  };

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

  // Add useEffect to fetch seals when session details are loaded
  useEffect(() => {
    if (session) {
      fetchSessionSeals();
    }
  }, [session, fetchSessionSeals]);
  
  // Enhanced render all seals function
  const renderAllSeals = () => {
    // Use the hook for session seals
    const { sessionSeals: hookSeals, loadingSeals: hookLoading, sealsError: hookError, fetchSessionSeals: refreshSeals } = useSessionSeals(sessionId);
    
    // Check if we should use the SealVerification component
    const shouldUseSealVerificationComponent = userSubrole === EmployeeSubrole.GUARD && 
      session?.status !== SessionStatus.COMPLETED;
    
    if (shouldUseSealVerificationComponent && hookSeals) {
      return (
        <SealVerification 
          sessionId={sessionId}
          sessionSeals={hookSeals}
          refreshSeals={refreshSeals}
          refreshSession={fetchSessionDetails}
          isGuard={userSubrole === EmployeeSubrole.GUARD}
          isCompleted={session?.status === SessionStatus.COMPLETED}
        />
      );
    }
    
    // Otherwise use the normal seals display
    if (loadingSeals || hookLoading) {
      return (
        <Box display="flex" justifyContent="center" p={2}>
          <CircularProgress size={24} />
        </Box>
      );
    }
    
    if (sealsError || hookError) {
      return (
        <Alert severity="error" sx={{ mb: 2 }}>
          <AlertTitle>Error Loading Seals</AlertTitle>
          {sealsError || hookError}
          <Button 
            size="small" 
            onClick={hookSeals ? refreshSeals : fetchSessionSeals} 
            sx={{ mt: 1 }}
            startIcon={<Refresh />}
          >
            Retry
          </Button>
        </Alert>
      );
    }
    
    // Use hook seals or fallback to component state, and ensure it's always an array
    const displaySeals = (hookSeals || sessionSeals || []);
    
    if (displaySeals.length === 0) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No seals found for this session.
          </Typography>
        </Box>
      );
    }
    
    // Group seals by type
    const tagSeals = displaySeals.filter(seal => seal?.type === 'tag') || [];
    const systemSeals = displaySeals.filter(seal => seal?.type === 'system' || seal?.type === 'verification') || [];
    
    return (
      <>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Total Seals: <strong>{sessionSeals.length}</strong> 
          {tagSeals.length > 0 && <> (Operator Tags: <strong>{tagSeals.length}</strong>, Verification Seals: <strong>{systemSeals.length}</strong>)</>}
        </Typography>
        
        {/* System Seals Table */}
        {systemSeals.length > 0 && (
          <>
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
              Verification Seals
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'background.paper' }}>
                    <TableCell>No.</TableCell>
                    <TableCell>Barcode/ID</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Created At</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Verified By</TableCell>
                    <TableCell>Verified At</TableCell>
                    <TableCell>Details</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {systemSeals.map((seal, index) => {
                    // Determine if all fields match from verification data
                    const allMatch = seal.verificationDetails?.allMatch;
                    let statusColor = seal.verified ? "success" : "default";
                    
                    // If verified but fields don't match, use warning color
                    if (seal.verified && allMatch === false) {
                      statusColor = "warning";
                    }
                    
                    return (
                      <TableRow key={seal.id} hover sx={{
                        bgcolor: seal.verified ? 
                          (allMatch === false ? 'rgba(255, 152, 0, 0.08)' : 'rgba(46, 125, 50, 0.08)') : 
                          'inherit'
                      }}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>
                          <Box 
                            sx={{ 
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              p: 0.75,
                              bgcolor: 'background.paper',
                              maxWidth: 180,
                              overflow: 'hidden'
                            }}
                          >
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 'medium' }}>
                              {seal.barcode}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            size="small" 
                            label={seal.type === 'system' ? 'System' : 'Verification'} 
                            color={seal.type === 'system' ? 'primary' : 'secondary'}
                          />
                        </TableCell>
                        <TableCell>{formatDate(seal.createdAt)}</TableCell>
                        <TableCell>
                          <Chip 
                            label={
                              seal.verified 
                                ? (seal.verificationDetails?.allMatch === false 
                                    ? "Verified with Issues" 
                                    : "Verified")
                                : "Unverified"
                            } 
                            color={statusColor as "success" | "warning" | "default"}
                            size="small"
                            icon={
                              seal.verified 
                                ? (seal.verificationDetails?.allMatch === false 
                                    ? <Warning fontSize="small" /> 
                                    : <CheckCircle fontSize="small" />)
                                : <RadioButtonUnchecked fontSize="small" />
                            }
                          />
                        </TableCell>
                        <TableCell>
                          {seal.verifiedBy ? (
                            <Tooltip title={`User ID: ${seal.verifiedBy.id}`}>
                              <Typography variant="body2">
                                {seal.verifiedBy.name || 'Unknown'} 
                                <Typography variant="caption" component="span" color="text.secondary">
                                  {' '}({seal.verifiedBy.subrole || seal.verifiedBy.role || 'User'})
                                </Typography>
                              </Typography>
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              Not verified yet
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {seal.scannedAt ? (
                            <Tooltip title={new Date(seal.scannedAt).toLocaleString()}>
                              <Typography variant="body2">
                                {formatDate(seal.scannedAt)}
                              </Typography>
                            </Tooltip>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              N/A
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {seal.verified && (
                            <Tooltip title="View verification details">
                              <IconButton 
                                size="small"
                                onClick={() => {
                                  console.log("Viewing seal details:", seal);
                                  setSelectedSeal(seal);
                                  setDetailsDialogOpen(true);
                                }}
                              >
                                <InfoOutlined fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
        
        {/* Operator Seal Tags Table */}
        {tagSeals.length > 0 && (
          <>
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 3 }}>
              Operator Seal Tags
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'background.paper' }}>
                    <TableCell>No.</TableCell>
                    <TableCell>Tag ID</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Image</TableCell>
                    <TableCell>Created At</TableCell>
                    <TableCell>Created By</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tagSeals.map((seal, index) => (
                    <TableRow key={seal.id} hover>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>
                        <Box 
                          sx={{ 
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            p: 0.75,
                            bgcolor: 'background.paper',
                            maxWidth: 180,
                            overflow: 'hidden'
                          }}
                        >
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.9rem', fontWeight: 'medium' }}>
                            {seal.barcode}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          size="small" 
                          label={seal.method === 'digital' ? 'Scanned' : 'Manual'} 
                          color={seal.method === 'digital' ? 'info' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        {seal.imageData ? (
                          <Box 
                            component="img" 
                            src={seal.imageData} 
                            alt={`Seal tag ${seal.barcode}`}
                            sx={{ 
                              width: 60, 
                              height: 60, 
                              objectFit: 'cover',
                              borderRadius: 1,
                              cursor: 'pointer'
                            }}
                            onClick={() => {
                              // Open image in new tab
                              window.open(seal.imageData, '_blank');
                            }}
                          />
                        ) : (
                          <Typography variant="caption">No image</Typography>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(seal.createdAt)}</TableCell>
                      <TableCell>
                        {seal.createdBy ? (
                          <Typography variant="body2">
                            {seal.createdBy.name || 'Unknown'} 
                            <Typography variant="caption" component="span" color="text.secondary">
                              {' '}({seal.createdBy.subrole || seal.createdBy.role || 'User'})
                            </Typography>
                          </Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Unknown
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
        
        <Box display="flex" justifyContent="flex-end">
          <Button
            size="small"
            startIcon={<Refresh />}
            onClick={fetchSessionSeals}
            variant="outlined"
          >
            Refresh Seals
          </Button>
        </Box>
        
        {/* Seal Details Dialog */}
        <Dialog 
          open={detailsDialogOpen} 
          onClose={() => setDetailsDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">
                Seal Details
              </Typography>
              <IconButton onClick={() => setDetailsDialogOpen(false)} size="small">
                <Close />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            {selectedSeal && (
              <>
                {/* Seal Information */}
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Seal Information
                    </Typography>
                    
                    <Box 
                      sx={{ 
                        display: 'inline-block',
                        border: '2px solid',
                        borderColor: selectedSeal.verified ? 'success.main' : 'divider',
                        borderRadius: 1,
                        p: 1.5,
                        mt: 1,
                        mb: 2,
                        bgcolor: 'background.paper' 
                      }}
                    >
                      <Typography variant="h6" component="div" sx={{ fontFamily: 'monospace', letterSpacing: 1 }}>
                        {selectedSeal.barcode}
                      </Typography>
                    </Box>
                    
                                         <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                        <Box sx={{ flex: '1 0 45%', minWidth: '200px' }}>
                          <Typography variant="body2" color="text.secondary">Type</Typography>
                          <Typography variant="body1">{selectedSeal.type === 'system' ? 'System Seal' : 'Verification Seal'}</Typography>
                        </Box>
                        <Box sx={{ flex: '1 0 45%', minWidth: '200px' }}>
                          <Typography variant="body2" color="text.secondary">Status</Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                            <Chip 
                              label={selectedSeal.verified ? "Verified" : "Unverified"} 
                              color={selectedSeal.verified ? "success" : "default"}
                              size="small"
                              icon={selectedSeal.verified ? <CheckCircle fontSize="small" /> : <RadioButtonUnchecked fontSize="small" />}
                            />
                          </Box>
                        </Box>
                        <Box sx={{ flex: '1 0 45%', minWidth: '200px' }}>
                          <Typography variant="body2" color="text.secondary">Created At</Typography>
                          <Typography variant="body1">{new Date(selectedSeal.createdAt).toLocaleString()}</Typography>
                        </Box>
                        <Box sx={{ flex: '1 0 45%', minWidth: '200px' }}>
                          <Typography variant="body2" color="text.secondary">Seal ID</Typography>
                          <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>{selectedSeal.id}</Typography>
                        </Box>
                     </Box>
                  </Box>
                  
                  {selectedSeal.verified && (
                    <Box>
                      <Typography variant="subtitle1" gutterBottom>
                        Verification Information
                      </Typography>
                                             <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                         <Box sx={{ flex: '1 0 45%', minWidth: '200px' }}>
                           <Typography variant="body2" color="text.secondary">Verified By</Typography>
                           <Typography variant="body1">
                             {selectedSeal.verifiedBy?.name || 'Unknown'} 
                             <Typography variant="caption" component="span" color="text.secondary">
                               {' '}({selectedSeal.verifiedBy?.subrole || selectedSeal.verifiedBy?.role || 'User'})
                             </Typography>
                           </Typography>
                         </Box>
                         <Box sx={{ flex: '1 0 45%', minWidth: '200px' }}>
                           <Typography variant="body2" color="text.secondary">Verified At</Typography>
                           <Typography variant="body1">
                             {selectedSeal.scannedAt ? new Date(selectedSeal.scannedAt).toLocaleString() : 'N/A'}
                           </Typography>
                         </Box>
                         {selectedSeal.verificationDetails?.allMatch !== undefined && (
                           <Box sx={{ flex: '1 0 45%', minWidth: '200px' }}>
                             <Typography variant="body2" color="text.secondary">Field Verification</Typography>
                             <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                               <Chip 
                                 label={selectedSeal.verificationDetails.allMatch ? "All Fields Match" : "Some Fields Mismatched"} 
                                 color={selectedSeal.verificationDetails.allMatch ? "success" : "warning"}
                                 size="small"
                                 icon={selectedSeal.verificationDetails.allMatch ? 
                                   <CheckCircle fontSize="small" /> : 
                                   <Warning fontSize="small" />
                                 }
                               />
                             </Box>
                           </Box>
                         )}
                         {selectedSeal.verificationDetails?.verificationTimestamp && (
                           <Box sx={{ flex: '1 0 45%', minWidth: '200px' }}>
                             <Typography variant="body2" color="text.secondary">Verification Timestamp</Typography>
                             <Typography variant="body1">
                               {new Date(selectedSeal.verificationDetails.verificationTimestamp).toLocaleString()}
                             </Typography>
                           </Box>
                         )}
                       </Box>
                    </Box>
                  )}
                </Paper>
                
                {/* Field Verifications */}
                {selectedSeal.verificationDetails?.fieldVerifications && Object.keys(selectedSeal.verificationDetails.fieldVerifications).length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Field Verification Details
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Field</TableCell>
                            <TableCell>Operator Value</TableCell>
                            <TableCell>Guard Value</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Comment</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(selectedSeal.verificationDetails.fieldVerifications).map(([field, data]: [string, any]) => {
                            const matches = data.matches === true;
                            const isVerified = data.isVerified === true;
                            
                            return (
                              <TableRow key={field} sx={{ 
                                bgcolor: isVerified ? (matches ? 'rgba(46, 125, 50, 0.08)' : 'rgba(255, 152, 0, 0.08)') : 'inherit'
                              }}>
                                <TableCell>{getFieldLabel(field)}</TableCell>
                                <TableCell>{data.operatorValue !== undefined ? String(data.operatorValue) : 'N/A'}</TableCell>
                                <TableCell>{data.guardValue !== undefined ? String(data.guardValue) : 'N/A'}</TableCell>
                                <TableCell>
                                  {isVerified ? (
                                    <Chip 
                                      label={matches ? "Match" : "Mismatch"} 
                                      color={matches ? "success" : "warning"}
                                      size="small"
                                      icon={matches ? <CheckCircle fontSize="small" /> : <Warning fontSize="small" />}
                                    />
                                  ) : (
                                    <Chip 
                                      label="Unverified" 
                                      color="default"
                                      size="small"
                                    />
                                  )}
                                </TableCell>
                                <TableCell>{data.comment || 'No comment'}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Paper>
                )}
                
                {/* Image Verification */}
                {selectedSeal.verificationDetails?.guardImages && Object.keys(selectedSeal.verificationDetails.guardImages).length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Verification Images
                    </Typography>
                                         <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                       {Object.entries(selectedSeal.verificationDetails.guardImages || {}).map(([key, url]) => {
                         if (Array.isArray(url)) {
                           return url.map((imageUrl, idx) => (
                            <Box key={`${key}-${idx}`} sx={{ width: 150, height: 150, position: 'relative' }}>
                              <Typography variant="caption" sx={{ mb: 0.5 }}>
                                {getFieldLabel(key)} {idx + 1}
                              </Typography>
                              <img 
                                src={imageUrl as string} 
                                alt={`${key} ${idx + 1}`}
                                style={{ 
                                  width: '100%', 
                                  height: '100%', 
                                  objectFit: 'cover',
                                  borderRadius: '4px',
                                  border: '1px solid #ddd'
                                }}
                              />
                            </Box>
                          ));
                        }
                        
                        return (
                          <Box key={key} sx={{ width: 150, height: 150, position: 'relative' }}>
                            <Typography variant="caption" sx={{ mb: 0.5 }}>
                              {getFieldLabel(key)}
                            </Typography>
                            <img 
                              src={typeof url === 'string' ? url : ''} 
                              alt={key}
                              style={{ 
                                width: '100%', 
                                height: '100%', 
                                objectFit: 'cover',
                                borderRadius: '4px',
                                border: '1px solid #ddd'
                              }}
                            />
                          </Box>
                        );
                      })}
                    </Box>
                  </Paper>
                )}
                
                {/* JSON Debug */}
                <Box sx={{ mt: 3 }}>
                  <details>
                    <summary>
                      <Typography variant="caption" component="span">
                        Technical Details (Debug)
                      </Typography>
                    </summary>
                    <Box 
                      component="pre" 
                      sx={{ 
                        mt: 1, 
                        p: 2, 
                        bgcolor: 'background.paper', 
                        border: '1px solid', 
                        borderColor: 'divider',
                        borderRadius: 1,
                        overflow: 'auto',
                        fontSize: '0.7rem',
                        maxHeight: 300
                      }}
                    >
                      {JSON.stringify(selectedSeal, null, 2)}
                    </Box>
                  </details>
                </Box>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogActions>
        </Dialog>
      </>
    );
  };

  // Handle image comment changes
  const handleImageCommentChange = (imageKey: string, comment: string) => {
    setImageComments(prev => ({
      ...prev,
      [imageKey]: comment
    }));
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
              
              {/* Basic information */}
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

              {/* Only show Vehicle Number from Trip Details */}
              {session.tripDetails?.vehicleNumber && (
                <Box mb={3}>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                    <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                      <Typography variant="body1">
                        <strong>Vehicle Number:</strong> {session.tripDetails.vehicleNumber}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              )}
            </Paper>

            {/* Verification Results */}
            {renderVerificationResults()}

            {/* Comment section - moved after verification results */}
            <CommentSection sessionId={sessionId} />
          </>
        )}

        {/* Verification Form */}
        {verificationFormOpen && (
          <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
            {/* Tab Navigation */}
            <Box sx={{ display: 'flex', borderBottom: 1, borderColor: 'divider', mb: 3, overflowX: 'auto' }}>
              {verificationTabs.map((label, index) => (
                <Button
                  key={index}
                  variant={activeTab === index ? "contained" : "text"}
                  onClick={() => setActiveTab(index)}
                  sx={{ 
                    minWidth: 'unset',
                    px: 2,
                    py: 1,
                    borderRadius: 0,
                    borderBottom: activeTab === index ? '2px solid' : 'none',
                    backgroundColor: activeTab === index ? 'primary.main' : 'transparent',
                    color: activeTab === index ? 'primary.contrastText' : 'text.primary',
                    '&:hover': {
                      backgroundColor: activeTab === index ? 'primary.dark' : 'action.hover',
                    }
                  }}
                >
                  {label}
                </Button>
              ))}
            </Box>
            
            {/* Tab Content */}
            {activeTab === 0 && renderTripDetailsVerification()}
            {activeTab === 1 && renderSealVerification()}
            {activeTab === 2 && renderDriverDetailsVerification()}
            {activeTab === 3 && renderImageVerification()}

            {/* Navigation and Verification Actions */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button
                variant="outlined"
                onClick={() => setActiveTab(prev => Math.max(0, prev - 1))}
                disabled={activeTab === 0}
                startIcon={<ArrowBack />}
              >
                Previous
              </Button>
              <Box>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={openConfirmDialog}
                  startIcon={<VerifiedUser />}
                  sx={{ ml: 2 }}
                >
                  Complete Verification
                </Button>
              </Box>
              <Button
                variant="outlined"
                onClick={() => setActiveTab(prev => Math.min(verificationTabs.length - 1, prev + 1))}
                disabled={activeTab === verificationTabs.length - 1}
                endIcon={<ArrowForward />}
              >
                Next
              </Button>
            </Box>
          </Paper>
        )}

        {/* Verification Results */}
        {verificationResults && renderVerificationResults()}

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

                {/* Show seal information only if operator-entered seal tags are available */}
        {operatorSeals && operatorSeals.length > 0 && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom>
              Seal Information
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Typography variant="body2" sx={{ mb: 2 }}>
              Total Seal Tags: <strong>{operatorSeals.length}</strong>
                </Typography>
            
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>No.</TableCell>
                    <TableCell>Seal Tag ID</TableCell>
                    <TableCell>Method</TableCell>
                    <TableCell>Image</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {operatorSeals.map((seal, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{seal.id}</TableCell>
                      <TableCell>
                        <Chip 
                          label={seal.method === 'digital' ? "Scanned" : "Manual Entry"}
                          color="primary" 
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {seal.image ? (
                          <Box 
                            component="img" 
                            src={seal.image} 
                            alt={`Seal tag ${index+1}`}
                            sx={{ 
                              width: 60, 
                              height: 60, 
                              objectFit: 'cover',
                              borderRadius: 1,
                              cursor: 'pointer'
                            }}
                            onClick={() => {
                              // Open image in new tab
                              window.open(seal.image!, '_blank');
                            }}
                          />
                        ) : (
                          <Typography variant="caption">No image</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Add All Verification Seals section */}
        <Box mb={3}>
          <Typography variant="h6" gutterBottom>
            All Verification Seals
          </Typography>
          <Divider sx={{ mb: 2 }} />
          {renderAllSeals()}
        </Box>

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
            </Box>
          </Box>
        )}

        {/* Field Verification Summary - Show for completed sessions */}
        {session.status === SessionStatus.COMPLETED && (
          <Box mb={3}>
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
              Field Verification Summary
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            {verificationResults ? (
              <>
                <TableContainer component={Paper} variant="outlined" sx={{ mb: 4 }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.100' }}>
                        <TableCell width="30%"><strong>Field</strong></TableCell>
                        <TableCell width="25%"><strong>Operator Value</strong></TableCell>
                        <TableCell width="25%"><strong>Guard Value</strong></TableCell>
                        <TableCell width="20%" align="center"><strong>Status</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {/* Matching fields (green) - PASS */}
                      {verificationResults.matches.map(field => {
                        const data = verificationResults.allFields[field];
                        return (
                          <TableRow key={field} sx={{ 
                            bgcolor: 'rgba(46, 125, 50, 0.15)', 
                            '&:hover': { bgcolor: 'rgba(46, 125, 50, 0.25)' }
                          }}>
                            <TableCell component="th" scope="row" sx={{ color: 'success.dark', fontWeight: 'medium' }}>
                              {getFieldLabel(field)}
                            </TableCell>
                            <TableCell sx={{ color: 'success.dark' }}>{String(data.operatorValue || 'N/A')}</TableCell>
                            <TableCell sx={{ color: 'success.dark' }}>{String(data.guardValue || 'Not provided')}</TableCell>
                            <TableCell align="center">
                              <Box display="flex" alignItems="center" justifyContent="center" sx={{ color: 'success.main' }}>
                                <CheckCircle fontSize="small" sx={{ mr: 0.5 }} />
                                <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold' }}>Pass</Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      
                      {/* Mismatched fields (red) - FAIL */}
                      {verificationResults.mismatches.map(field => {
                        const data = verificationResults.allFields[field];
                        return (
                          <TableRow key={field} sx={{ 
                            bgcolor: 'rgba(211, 47, 47, 0.15)', 
                            '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.25)' }
                          }}>
                            <TableCell component="th" scope="row" sx={{ color: 'error.dark', fontWeight: 'medium' }}>
                              {getFieldLabel(field)}
                            </TableCell>
                            <TableCell sx={{ color: 'error.dark' }}>{String(data.operatorValue || 'N/A')}</TableCell>
                            <TableCell sx={{ color: 'error.dark' }}>{String(data.guardValue || 'Not provided')}</TableCell>
                            <TableCell align="center">
                              <Box display="flex" alignItems="center" justifyContent="center" sx={{ color: 'error.main' }}>
                                <Warning fontSize="small" sx={{ mr: 0.5 }} />
                                <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 'bold' }}>Fail</Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      
                      {/* Unverified fields (red) - FAIL */}
                      {verificationResults.unverified.map(field => {
                        const data = verificationResults.allFields[field];
                        return (
                          <TableRow key={field} sx={{ 
                            bgcolor: 'rgba(211, 47, 47, 0.15)', 
                            '&:hover': { bgcolor: 'rgba(211, 47, 47, 0.25)' }
                          }}>
                            <TableCell component="th" scope="row" sx={{ color: 'error.dark', fontWeight: 'medium' }}>
                              {getFieldLabel(field)}
                            </TableCell>
                            <TableCell sx={{ color: 'error.dark' }}>{String(data.operatorValue || 'N/A')}</TableCell>
                            <TableCell sx={{ color: 'error.dark' }}>{String(data.guardValue || 'Not provided')}</TableCell>
                            <TableCell align="center">
                              <Box display="flex" alignItems="center" justifyContent="center" sx={{ color: 'error.main' }}>
                                <Warning fontSize="small" sx={{ mr: 0.5 }} />
                                <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 'bold' }}>Fail</Typography>
                              </Box>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Summary statistics */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                  <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                    <Paper sx={{ p: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
                      <Typography variant="h5" align="center">{verificationResults.matches.length}</Typography>
                      <Typography variant="body2" align="center">Matching Fields</Typography>
                    </Paper>
                  </Box>
                  <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                    <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
                      <Typography variant="h5" align="center">{verificationResults.mismatches.length}</Typography>
                      <Typography variant="body2" align="center">Mismatched Fields</Typography>
                    </Paper>
                  </Box>
                  <Box sx={{ flex: '1 0 30%', minWidth: '200px' }}>
                    <Paper sx={{ p: 2, bgcolor: 'error.light', color: 'error.contrastText' }}>
                      <Typography variant="h5" align="center">{verificationResults.unverified.length}</Typography>
                      <Typography variant="body2" align="center">Unverified Fields</Typography>
                    </Paper>
                  </Box>
                </Box>
              </>
            ) : (
              <Alert severity="info">
                <AlertTitle>Verification Data Not Available</AlertTitle>
                <Typography variant="body2">
                  This session has been verified, but detailed verification data is not available.
                </Typography>
              </Alert>
            )}
          </Box>
        )}
      </Paper>

      {/* Verification Results */}
      {renderVerificationResults()}

      {/* GUARD Verification Button - Show for GUARD users with IN_PROGRESS sessions */}
      {isGuard && session.status === SessionStatus.IN_PROGRESS && !verificationFormOpen && (
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

      {/* Comment section - moved after verification results */}
      <CommentSection sessionId={sessionId} />
      
      {/* Add Status Update Dialog */}
      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Update Seal Status
          {selectedSealForStatus && (
            <Typography variant="subtitle1" color="text.secondary">
              Seal ID: {selectedSealForStatus.barcode}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          {selectedSealForStatus && (
            <>
              <Alert 
                severity={selectedSealForStatus.status === SealStatus.BROKEN ? 'warning' : 'error'}
                sx={{ mb: 3 }}
              >
                <AlertTitle>
                  {selectedSealForStatus.status === SealStatus.BROKEN 
                    ? 'Marking Seal as Broken' 
                    : 'Marking Seal as Tampered'}
                </AlertTitle>
                <Typography variant="body2">
                  {selectedSealForStatus.status === SealStatus.BROKEN 
                    ? 'Use this option if the seal is physically damaged but appears to be an accident or normal wear.'
                    : 'Use this option if the seal shows signs of intentional tampering or unauthorized access.'}
                </Typography>
              </Alert>
              
              <TextField
                fullWidth
                label="Comments (Required)"
                multiline
                rows={3}
                value={statusComment}
                onChange={(e) => setStatusComment(e.target.value)}
                placeholder={selectedSealForStatus.status === SealStatus.BROKEN 
                  ? "Describe the damage to the seal..."
                  : "Describe the signs of tampering..."}
                required
                sx={{ mb: 3 }}
              />
              
              <Typography variant="subtitle1" gutterBottom>
                Evidence Photos (Required)
              </Typography>
              
              {statusEvidence.photos && statusEvidence.photos.length > 0 ? (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {statusEvidence.photos.map((photo, index) => (
                    <Box
                      key={index}
                      component="img"
                      src={photo}
                      sx={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 1 }}
                    />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  No photos added yet. Please add at least one photo.
                </Typography>
              )}
              
              <Button
                variant="outlined"
                startIcon={<CloudUpload />}
                onClick={() => fileInputRef.current?.click()}
                sx={{ mt: 1 }}
              >
                Add Photo
              </Button>
              <input
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handlePhotoUpload}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)} disabled={isSubmittingStatus}>
            Cancel
          </Button>
          <Button 
            onClick={handleStatusUpdateSubmit} 
            variant="contained" 
            color={selectedSealForStatus?.status === SealStatus.BROKEN ? 'warning' : 'error'}
            disabled={isSubmittingStatus || !statusComment || !statusEvidence.photos || statusEvidence.photos.length === 0}
          >
            {isSubmittingStatus ? (
              <>
                <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                Updating...
              </>
            ) : (
              `Confirm ${selectedSealForStatus?.status}`
            )}
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Add Verification Summary Dialog */}
      <Dialog open={verificationSummaryOpen} onClose={() => setVerificationSummaryOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Verification Summary</DialogTitle>
        <DialogContent>
          {verificationSummary && (
            <>
              <Alert severity="info" sx={{ mb: 3 }}>
                <AlertTitle>Completing Verification</AlertTitle>
                <Typography variant="body2">
                  You are about to complete the verification process. Any unscanned seals will be marked as MISSING.
                  Please review the summary below and confirm.
                </Typography>
              </Alert>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 3 }}>
                <Box sx={{ flex: '1 1 300px' }}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Total Seals
                    </Typography>
                    <Typography variant="h3" align="center">
                      {verificationSummary.totalSeals}
                    </Typography>
                  </Paper>
                </Box>
                <Box sx={{ flex: '1 1 300px' }}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Scanned Seals
                    </Typography>
                    <Typography variant="h3" align="center" color="success.main">
                      {verificationSummary.scannedSeals}
                    </Typography>
                  </Paper>
                </Box>
                <Box sx={{ flex: '1 1 300px' }}>
                  <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                    <Typography variant="subtitle1" gutterBottom>
                      Unscanned Seals (Will be marked as MISSING)
                    </Typography>
                    <Typography variant="h3" align="center" color="error.main">
                      {verificationSummary.totalSeals - verificationSummary.scannedSeals}
                    </Typography>
                  </Paper>
                </Box>
              </Box>
              
              <Typography variant="subtitle1" gutterBottom>
                Status Breakdown
              </Typography>
              <TableContainer component={Paper} variant="outlined" sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <CheckCircle color="success" sx={{ mr: 1 }} />
                          Verified
                        </Box>
                      </TableCell>
                      <TableCell align="right">{verificationSummary.statusBreakdown[SealStatus.VERIFIED] || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Close color="error" sx={{ mr: 1 }} />
                          Missing
                        </Box>
                      </TableCell>
                      <TableCell align="right">{verificationSummary.statusBreakdown[SealStatus.MISSING] || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Warning color="warning" sx={{ mr: 1 }} />
                          Broken
                        </Box>
                      </TableCell>
                      <TableCell align="right">{verificationSummary.statusBreakdown[SealStatus.BROKEN] || 0}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Warning color="error" sx={{ mr: 1 }} />
                          Tampered
                        </Box>
                      </TableCell>
                      <TableCell align="right">{verificationSummary.statusBreakdown[SealStatus.TAMPERED] || 0}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              
              <Typography variant="body2" color="text.secondary">
                After completion, this session will be marked as COMPLETED and the verification details will be saved.
                This action cannot be undone.
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setVerificationSummaryOpen(false)} disabled={completingVerification}>
            Cancel
          </Button>
          <Button 
            onClick={confirmAndCompleteVerification} 
            variant="contained" 
            color="success"
            disabled={completingVerification}
          >
            {completingVerification ? (
              <>
                <CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />
                Completing...
              </>
            ) : (
              "Complete Verification"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
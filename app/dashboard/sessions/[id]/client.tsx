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
  Grid as MuiGrid,
  InputAdornment
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
  QrCode
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
  const [isScanning, setIsScanning] = useState(false);
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

  // Extract operator seals from session data
  const operatorSeals = useMemo(() => {
    if (!session) return [];
    
    const seals: Array<{
      id: string;
      method: string;
      image: string | null;
      timestamp: string;
    }> = [];
    
    // Primary seal
    if (session.seal?.barcode) {
      seals.push({
        id: session.seal.barcode,
        method: 'digital',
        image: session.images?.sealingImages?.[0] || null,
        timestamp: session.createdAt
      });
    }
    
    // Additional seals
    if (session.qrCodes?.additionalBarcodes) {
      session.qrCodes.additionalBarcodes.forEach((barcode, index) => {
        seals.push({
          id: barcode,
          method: 'digital',
          image: session.images?.sealingImages?.[index + 1] || null,
          timestamp: session.timestamps?.loadingDetails?.sealingTime || session.createdAt
        });
      });
    }
    
    return seals;
  }, [session]);

  // Utility functions  
  const getFieldLabel = useCallback((key: string): string => {
    // Convert camelCase to Title Case with spaces
    return key.replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  }, []);

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

  const verifyField = useCallback((field: string) => {
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
  }, [verificationFields]);

  // Handle QR/barcode scanner input
  const handleScanComplete = useCallback((sealId: string) => {
    if (!sealId.trim()) {
      setScanError('Please enter a valid Seal Tag ID');
      return;
    }
    
    // Check if already scanned by guard
    if (guardScannedSeals.some(seal => seal.id === sealId)) {
      setScanError('This seal has already been scanned');
      return;
    }
    
    // Add to scanned seals
    const newSeal = {
      id: sealId,
      method: scanMethod,
      image: null,
      imagePreview: null,
      timestamp: new Date().toISOString(),
      verified: operatorSeals.some(seal => seal.id === sealId)
    };
    
    setGuardScannedSeals(prev => [...prev, newSeal]);
    setScanInput('');
    setScanError('');
    
    // Update comparison
    updateSealComparison([...guardScannedSeals, newSeal]);
  }, [guardScannedSeals, scanMethod, operatorSeals]);

  // Update seal comparison data
  const updateSealComparison = useCallback((scannedSeals: typeof guardScannedSeals) => {
    const guardSealIds = scannedSeals.map(seal => seal.id);
    const operatorSealIds = operatorSeals.map(seal => seal.id);
    
    const matched = guardSealIds.filter(id => operatorSealIds.includes(id));
    const mismatched = [
      ...guardSealIds.filter(id => !operatorSealIds.includes(id)),
      ...operatorSealIds.filter(id => !guardSealIds.includes(id))
    ];
    
    setSealComparison({ matched, mismatched });
  }, [operatorSeals]);

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

  // Start/stop scanner
  const toggleScanner = useCallback(() => {
    setIsScanning(!isScanning);
    if (!isScanning) {
      setScanMethod('digital');
    } else {
      setScanMethod('manual');
    }
  }, [isScanning]);

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

  // Helper function to extract and set verification results
  const extractAndSetVerificationResults = useCallback((fieldVerifications: Record<string, any>) => {
    console.log("Extracting verification results from data:", Object.keys(fieldVerifications).length, "fields");
    
    // Extract matched, mismatched and unverified fields
    const matches: string[] = [];
    const mismatches: string[] = [];
    const unverified: string[] = [];
    
    Object.entries(fieldVerifications).forEach(([field, data]: [string, any]) => {
      console.log(`Field ${field}:`, data);
      
      // Handle different verification data structures
      const isVerified = data.isVerified ?? false;
      const matchesField = typeof data.matches === 'boolean' 
        ? data.matches 
        : (String(data.operatorValue || '').toLowerCase() === String(data.guardValue || '').toLowerCase());
      
      if (isVerified) {
        if (matchesField) {
          matches.push(field);
        } else {
          mismatches.push(field);
        }
      } else {
        unverified.push(field);
      }
    });
    
    console.log("Verification summary:", {
      matches: matches.length,
      mismatches: mismatches.length,
      unverified: unverified.length
    });
    
    // Set verification results for displaying
    setVerificationResults({
      matches,
      mismatches,
      unverified,
      allFields: fieldVerifications,
      timestamp: session?.seal?.scannedAt || new Date().toISOString()
    });
  }, [session]);

  // Extract verification results from session data for completed trips
  useEffect(() => {
    // Only process for completed sessions with seal verification data
    if (session?.status === SessionStatus.COMPLETED && 
        session?.seal?.verified) {
      
      console.log("Processing completed session for verification data:", session.id);
      console.log("Session seal data:", session.seal);
      
      // First, check if verification data is directly in the seal object
      if (session.seal.verificationData?.fieldVerifications) {
        console.log("Found verification data directly in seal.verificationData");
        extractAndSetVerificationResults(session.seal.verificationData.fieldVerifications);
        return;
      }
      
      // Then check activity logs if available
      if (session.activityLogs?.length) {
        console.log("Activity logs found:", session.activityLogs.length);
        
        // Look for verification logs with multiple possible action types
        const verificationActions = ["SEAL_VERIFIED", "VERIFY_SEAL", "SEAL_VERIFICATION"];
        
        // Search for logs with verification data and log what we find
        console.log("Searching logs for verification data");
        for (const log of session.activityLogs) {
          console.log(`Log action: ${log.action}, has details: ${!!log.details}`);
          
          if (log.details) {
            console.log("Log details keys:", Object.keys(log.details));
            
            // Check verification property
            if (log.details.verification) {
              console.log("Found verification details in log");
              
              if (log.details.verification.fieldVerifications) {
                console.log("Found fieldVerifications in log.details.verification");
                extractAndSetVerificationResults(log.details.verification.fieldVerifications);
                return;
              }
            }
          }
        }
        
        // If we didn't find structured verification data, look for any log with the right action
        const verificationLog = session.activityLogs.find(log => 
          verificationActions.includes(log.action)
        );
        
        if (verificationLog?.details) {
          console.log("Found verification log with action:", verificationLog.action);
          
          // Try different possible paths for verification data
          // Use optional chaining to safely access nested properties that might not exist
          if (verificationLog.details.verification?.fieldVerifications) {
            console.log("Found fieldVerifications in verification property");
            extractAndSetVerificationResults(verificationLog.details.verification.fieldVerifications);
            return;
          }
          
          // Check for other possible locations
          const detailsObj = verificationLog.details as any; // Type assertion to avoid TS errors
          
          if (detailsObj.fieldVerifications) {
            console.log("Found fieldVerifications directly in details");
            extractAndSetVerificationResults(detailsObj.fieldVerifications);
            return;
          }
          
          if (detailsObj.verificationData?.fieldVerifications) {
            console.log("Found fieldVerifications in verificationData");
            extractAndSetVerificationResults(detailsObj.verificationData.fieldVerifications);
            return;
          }
          
          if (detailsObj.data?.fieldVerifications) {
            console.log("Found fieldVerifications in data property");
            extractAndSetVerificationResults(detailsObj.data.fieldVerifications);
            return;
          }
          
          if (detailsObj.data?.verification?.fieldVerifications) {
            console.log("Found fieldVerifications in data.verification");
            extractAndSetVerificationResults(detailsObj.data.verification.fieldVerifications);
            return;
          }
        }
      }
      
      // If we still don't have verification data, create a basic placeholder
      console.log("No verification data found, creating placeholder");
      
      // Create basic verification results with just the seal data
      if (session.seal) {
        const placeholderResults = {
          matches: ["sealVerification"],
          mismatches: [],
          unverified: [],
          allFields: {
            sealVerification: {
              operatorValue: session.seal.barcode,
              guardValue: "Verified",
              matches: true,
              comment: "Seal verified without detailed field data",
              isVerified: true
            }
          },
          timestamp: session.seal.scannedAt || new Date().toISOString()
        };
        
        console.log("Setting placeholder verification results");
        setVerificationResults(placeholderResults);
      }
    }
  }, [session, extractAndSetVerificationResults]);
  
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
    if (!session?.seal) return;
    
    // Validate seal input only if provided
    if (sealInput && sealInput !== session.seal.barcode) {
      setSealError("The seal barcode you entered does not match the expected seal. Please verify and try again.");
      return;
    }
    
    setVerifying(true);
    setError("");
    setSealError("");
    
    try {
      // Upload any images that were provided (now optional)
      const uploadedImageUrls: {[key: string]: any} = {};
      
      // Helper function to upload single image
      const uploadImage = async (file: File, type: string): Promise<string> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);
        
        const response = await fetch(`/api/upload`, {
          method: 'POST',
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`Failed to upload ${type} image`);
        }
        
        const data = await response.json();
        return data.url;
      };
      
      // Upload any images that exist (all optional now)
      if (guardImages.driverPicture) {
        uploadedImageUrls.driverPicture = await uploadImage(guardImages.driverPicture, 'driver');
      }
      
      if (guardImages.vehicleNumberPlatePicture) {
        uploadedImageUrls.vehicleNumberPlatePicture = await uploadImage(guardImages.vehicleNumberPlatePicture, 'numberPlate');
      }
      
      if (guardImages.gpsImeiPicture) {
        uploadedImageUrls.gpsImeiPicture = await uploadImage(guardImages.gpsImeiPicture, 'gpsImei');
      }
      
      if (guardImages.sealingImages?.length) {
        uploadedImageUrls.sealingImages = await Promise.all(
          guardImages.sealingImages.map((file, index) => 
            uploadImage(file, `sealing-${index}`)
          )
        );
      }
      
      if (guardImages.vehicleImages?.length) {
        uploadedImageUrls.vehicleImages = await Promise.all(
          guardImages.vehicleImages.map((file, index) => 
            uploadImage(file, `vehicle-${index}`)
          )
        );
      }
      
      if (guardImages.additionalImages?.length) {
        uploadedImageUrls.additionalImages = await Promise.all(
          guardImages.additionalImages.map((file, index) => 
            uploadImage(file, `additional-${index}`)
          )
        );
      }
      
      // Calculate verification results for each field
      const fieldVerificationResults = Object.entries(verificationFields).reduce(
        (results, [field, data]) => {
          // Consider fields with values entered, even if not explicitly verified
          const isEffectivelyVerified = data.isVerified || !!data.guardValue;
          
          if (data.guardValue) {
            results[field] = {
              operatorValue: data.operatorValue,
              guardValue: data.guardValue,
              matches: String(data.operatorValue).toLowerCase() === String(data.guardValue).toLowerCase(),
              comment: data.comment,
              isVerified: isEffectivelyVerified
            };
          } else {
            // If no guard value provided, mark as incomplete
            results[field] = {
              operatorValue: data.operatorValue,
              guardValue: null,
              matches: false,
              comment: data.comment || "No value entered",
              isVerified: false
            };
          }
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
            guardImages: uploadedImageUrls,
            sealBarcode: sealInput || null,
            allMatch: Object.values(fieldVerificationResults).every(v => v.matches && v.isVerified),
            verificationTimestamp: new Date().toISOString()
          }
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to verify seal");
      }
      
      setVerificationSuccess(true);
      setVerificationFormOpen(false);
      
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
                <TableCell width="45%"><strong>Your Verification</strong></TableCell>
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
                <TableCell width="45%"><strong>Your Verification</strong></TableCell>
                <TableCell width="15%"><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {Object.entries(verificationFields)
                .filter(([field, _]) => [
                  'driverName', 'driverContactNumber', 'driverLicense'
                ].includes(field))
                .map(([field, data]) => (
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
                  Original photo:
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
            
            {/* Guard's verification photo */}
            <Box sx={{ width: '150px' }}>
              <Typography variant="caption" color="text.secondary" gutterBottom>
                Your verification photo:
              </Typography>
              <Box
                sx={{
                  border: '1px solid #ddd',
                  borderRadius: 1,
                  height: '150px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  p: 1,
                  backgroundColor: 'background.paper'
                }}
              >
                {imagePreviews.driverPicture ? (
                  <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
                    <img
                      src={imagePreviews.driverPicture}
                      alt="Driver Verification"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <IconButton
                      sx={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        bgcolor: 'background.paper',
                        '&:hover': { bgcolor: 'error.light' }
                      }}
                      size="small"
                      onClick={() => removeUploadedImage('driverPicture')}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                ) : (
          <Button
                    component="label"
                    variant="outlined"
                    startIcon={<CloudUpload />}
                    size="small"
                  >
                    Upload Photo
                    <input
                      type="file"
                      hidden
                      accept="image/*"
                      onChange={(e) => handleImageUpload('driverPicture', e.target.files?.[0] || null)}
                    />
          </Button>
                )}
              </Box>
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
          Image Upload
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Please upload your images taken at the destination. These images will be compared with the ones taken by the operator at source.
        </Typography>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {/* Driver Photo Upload */}
          <Box sx={{ flex: '1 0 45%', minWidth: '300px' }}>
            <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle1" gutterBottom>Driver Photo</Typography>
              
              {imagePreviews.driverPicture ? (
                // Preview with delete option
                <Box sx={{ position: 'relative', mb: 2 }}>
                  <img 
                    src={imagePreviews.driverPicture} 
                    alt="Driver Preview" 
                    style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                  />
                  <IconButton 
                    onClick={() => removeUploadedImage('driverPicture')}
                    sx={{ 
                      position: 'absolute', 
                      top: 5, 
                      right: 5, 
                      bgcolor: 'rgba(0,0,0,0.5)', 
                      color: 'white',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                    }}
                    size="small"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                // Upload interface
                <Box
                  sx={{
                    border: '2px dashed',
                    borderColor: 'divider',
                    p: 2,
                    mb: 2,
                    borderRadius: 1,
                    textAlign: 'center',
                    bgcolor: 'background.paper'
                  }}
                >
                  <input
                    type="file"
                    id="driverPicture-upload"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleImageUpload('driverPicture', e.target.files?.[0] || null)}
                  />
                  <label htmlFor="driverPicture-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<CloudUpload />}
                      sx={{ mb: 1 }}
                    >
                      Upload Driver Photo
                    </Button>
                  </label>
                  <Typography variant="caption" display="block" color="text.secondary">
                    Take a clear photo of the driver
                  </Typography>
                </Box>
              )}
              
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">
                  {guardImages.driverPicture ? 'Photo Uploaded' : 'No Photo Uploaded'}
                </Typography>
              </Box>
            </Paper>
          </Box>

          {/* Vehicle Number Plate Upload */}
          <Box sx={{ flex: '1 0 45%', minWidth: '300px' }}>
            <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle1" gutterBottom>Vehicle Number Plate</Typography>
              
              {imagePreviews.vehicleNumberPlatePicture ? (
                // Preview with delete option
                <Box sx={{ position: 'relative', mb: 2 }}>
                  <img 
                    src={imagePreviews.vehicleNumberPlatePicture} 
                    alt="Number Plate Preview" 
                    style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                  />
                  <IconButton 
                    onClick={() => removeUploadedImage('vehicleNumberPlatePicture')}
                    sx={{ 
                      position: 'absolute', 
                      top: 5, 
                      right: 5, 
                      bgcolor: 'rgba(0,0,0,0.5)', 
                      color: 'white',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                    }}
                    size="small"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                // Upload interface
                <Box
                  sx={{
                    border: '2px dashed',
                    borderColor: 'divider',
                    p: 2,
                    mb: 2,
                    borderRadius: 1,
                    textAlign: 'center',
                    bgcolor: 'background.paper'
                  }}
                >
                  <input
                    type="file"
                    id="numberPlate-upload"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleImageUpload('vehicleNumberPlatePicture', e.target.files?.[0] || null)}
                  />
                  <label htmlFor="numberPlate-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<CloudUpload />}
                      sx={{ mb: 1 }}
                    >
                      Upload Number Plate
                    </Button>
                  </label>
                  <Typography variant="caption" display="block" color="text.secondary">
                    Take a clear photo of the vehicle's number plate
                  </Typography>
                </Box>
              )}
              
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">
                  {guardImages.vehicleNumberPlatePicture ? 'Photo Uploaded' : 'No Photo Uploaded'}
                </Typography>
              </Box>
            </Paper>
          </Box>

          {/* GPS/IMEI Upload */}
          <Box sx={{ flex: '1 0 45%', minWidth: '300px' }}>
            <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
              <Typography variant="subtitle1" gutterBottom>GPS/IMEI</Typography>
              
              {imagePreviews.gpsImeiPicture ? (
                // Preview with delete option
                <Box sx={{ position: 'relative', mb: 2 }}>
                  <img 
                    src={imagePreviews.gpsImeiPicture} 
                    alt="GPS/IMEI Preview" 
                    style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '4px' }} 
                  />
                  <IconButton 
                    onClick={() => removeUploadedImage('gpsImeiPicture')}
                    sx={{ 
                      position: 'absolute', 
                      top: 5, 
                      right: 5, 
                      bgcolor: 'rgba(0,0,0,0.5)', 
                      color: 'white',
                      '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                    }}
                    size="small"
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              ) : (
                // Upload interface
                <Box
                  sx={{
                    border: '2px dashed',
                    borderColor: 'divider',
                    p: 2,
                    mb: 2,
                    borderRadius: 1,
                    textAlign: 'center',
                    bgcolor: 'background.paper'
                  }}
                >
                  <input
                    type="file"
                    id="gpsImei-upload"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleImageUpload('gpsImeiPicture', e.target.files?.[0] || null)}
                  />
                  <label htmlFor="gpsImei-upload">
                    <Button
                      variant="outlined"
                      component="span"
                      startIcon={<CloudUpload />}
                      sx={{ mb: 1 }}
                    >
                      Upload GPS/IMEI Photo
                    </Button>
                  </label>
                  <Typography variant="caption" display="block" color="text.secondary">
                    Take a clear photo of the GPS/IMEI number
                  </Typography>
                </Box>
              )}
              
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Typography variant="body2">
                  {guardImages.gpsImeiPicture ? 'Photo Uploaded' : 'No Photo Uploaded'}
                </Typography>
              </Box>
            </Paper>
          </Box>

          {/* Sealing Images Upload */}
          <Box sx={{ width: '100%' }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>Sealing Images</Typography>
              
              {/* Preview uploaded images */}
              {imagePreviews.sealingImages && imagePreviews.sealingImages.length > 0 && (
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                  {imagePreviews.sealingImages.map((preview, index) => (
                    <Box key={`sealing-preview-${index}`} sx={{ position: 'relative', flex: '1 0 30%', minWidth: '200px' }}>
                      <img 
                        src={preview} 
                        alt={`Sealing Preview ${index + 1}`} 
                        style={{ width: '100%', maxHeight: '150px', objectFit: 'cover', borderRadius: '4px' }} 
                      />
                      <IconButton 
                        onClick={() => removeUploadedImage('sealingImages', index)}
                        sx={{ 
                          position: 'absolute', 
                          top: 5, 
                          right: 5, 
                          bgcolor: 'rgba(0,0,0,0.5)', 
                          color: 'white',
                          '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' }
                        }}
                        size="small"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
              
              {/* Upload interface */}
              <Box
                sx={{
                  border: '2px dashed',
                  borderColor: 'divider',
                  p: 2,
                  borderRadius: 1,
                  textAlign: 'center',
                  bgcolor: 'background.paper'
                }}
              >
                <input
                  type="file"
                  id="sealing-upload"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={(e) => handleImageUpload('sealingImages', e.target.files || null)}
                />
                <label htmlFor="sealing-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    startIcon={<CloudUpload />}
                    sx={{ mb: 1 }}
                  >
                    Upload Sealing Images
                  </Button>
                </label>
                <Typography variant="caption" display="block" color="text.secondary">
                  Take clear photos of all seals applied to the vehicle
                </Typography>
              </Box>
              
              <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                <Typography variant="body2">
                  {imagePreviews.sealingImages && imagePreviews.sealingImages.length > 0 ? 
                    `${imagePreviews.sealingImages.length} image(s) uploaded` : 
                    'No images uploaded'}
                </Typography>
              </Box>
            </Paper>
          </Box>

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

  // Seal Verification Component
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

    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Seal Tags Verification
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Verify the seal tags by scanning each seal's barcode/QR code. Each tag should match with those applied by the operator.
        </Typography>

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
                disabled={isScanning}
              />
              
              <Button 
                variant="contained" 
                onClick={() => handleScanComplete(scanInput)}
                disabled={isScanning || !scanInput.trim()}
              >
                Add Manually
              </Button>
              
              <Button 
                variant={isScanning ? "outlined" : "contained"}
                color={isScanning ? "error" : "primary"}
                onClick={toggleScanner}
                startIcon={isScanning ? <Close /> : <QrCode />}
              >
                {isScanning ? "Cancel Scan" : "Scan QR/Barcode"}
              </Button>
            </Box>

            {isScanning && (
              <Box sx={{ p: 2, border: '1px dashed', borderColor: 'primary.main', borderRadius: 1, bgcolor: 'background.paper' }}>
                <Typography variant="body2" gutterBottom>
                  Position the QR/barcode in front of your camera. Scanning will automatically complete when detected.
              </Typography>
                
                {/* Here, you'd integrate an actual QR scanner component */}
                {/* For this implementation, we'll simulate with a button */}
                <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
                  <Button 
                    variant="outlined" 
                    onClick={() => {
                      // Simulate a successful scan with a random ID
                      const randomId = `SEAL${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
                      handleScanComplete(randomId);
                      setIsScanning(false);
                    }}
                  >
                    Simulate Successful Scan
                  </Button>
                </Box>
                </Box>
            )}
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
        {session.seal && (
          <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="subtitle1" gutterBottom>Seal Information</Typography>

            {/* Check for seal tag details in the activity logs */}
            {session.activityLogs && session.activityLogs.length > 0 ? (
              <Box>
                {(() => {
                  // Find the log with seal tag information
                  const sealTagLog = session.activityLogs.find(log => {
                    // Try various possible paths for seal tag data
                    if (log.details) {
                      // Check direct path
                      if ((log.details as any).sealTagIds) {
                        return true;
                      }
                      
                      // Check in tripDetails
                      if ((log.details as any).tripDetails && (log.details as any).tripDetails.sealTagIds) {
                        return true;
                      }
                      
                      // Check in imageBase64Data
                      if ((log.details as any).imageBase64Data && (log.details as any).imageBase64Data.sealTagImages) {
                        return true;
                      }
                      
                      // Check if details itself is the container
                      if (Array.isArray((log.details as any).sealTagIds)) {
                        return true;
                      }
                    }
                    return false;
                  });
                  
                  if (sealTagLog) {
                    // Extract seal tag data from wherever it's found
                    let sealTagIds: string[] = [];
                    let sealTagMethods: any = {};
                    let sealTagTimestamps: any = {};
                    
                    const details = sealTagLog.details as any;
                    
                    // Try various possible locations
                    if (details.sealTagIds) {
                      sealTagIds = details.sealTagIds;
                      sealTagMethods = details.sealTagMethods || {};
                      sealTagTimestamps = details.sealTagTimestamps || details.timestamps || {};
                    } else if (details.tripDetails && details.tripDetails.sealTagIds) {
                      sealTagIds = details.tripDetails.sealTagIds;
                      sealTagMethods = details.tripDetails.sealTagMethods || {};
                      sealTagTimestamps = details.tripDetails.timestamps || {};
                    } else if (details.imageBase64Data && details.imageBase64Data.sealTagImages) {
                      sealTagIds = Object.keys(details.imageBase64Data.sealTagImages);
                      // Extract methods if available
                      sealTagMethods = Object.keys(details.imageBase64Data.sealTagImages).reduce((acc: Record<string, string>, key) => {
                        acc[key] = details.imageBase64Data.sealTagImages[key].method || 'unknown';
                        return acc;
                      }, {});
                    }
                    
                    // Parse JSON strings if needed
                    if (typeof sealTagIds === 'string') {
                      try {
                        sealTagIds = JSON.parse(sealTagIds);
                      } catch (e) {
                        console.error("Failed to parse sealTagIds:", e);
                      }
                    }
                    
                    if (typeof sealTagMethods === 'string') {
                      try {
                        sealTagMethods = JSON.parse(sealTagMethods);
                      } catch (e) {
                        console.error("Failed to parse sealTagMethods:", e);
                      }
                    }
                    
                    if (typeof sealTagTimestamps === 'string') {
                      try {
                        sealTagTimestamps = JSON.parse(sealTagTimestamps);
                      } catch (e) {
                        console.error("Failed to parse sealTagTimestamps:", e);
                      }
                    }
                    
                    // Skip if we couldn't find any seal tags
                    if (!sealTagIds || sealTagIds.length === 0) {
                      return <Typography variant="body2">No seal tag information available in the logs.</Typography>;
                    }
                    
                    return (
                      <>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                          Total Seal Tags: <strong>{sealTagIds.length}</strong>
                        </Typography>
                        
                        <Box sx={{ 
                          maxHeight: '400px',
                          overflowY: 'auto',
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          p: 1
                        }}>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>No.</TableCell>
                                <TableCell>Seal Tag ID</TableCell>
                                <TableCell>Method</TableCell>
                                <TableCell>Timestamp</TableCell>
                                <TableCell>Image</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {sealTagIds.map((tagId: string, index: number) => (
                                <TableRow key={tagId}>
                                  <TableCell>{index + 1}</TableCell>
                                  <TableCell>{tagId}</TableCell>
                                  <TableCell>
                                    <Chip 
                                      label={sealTagMethods[tagId] === 'digitally scanned' ? 'Digitally Scanned' : 'Manually Entered'} 
                                      color={sealTagMethods[tagId] === 'digitally scanned' ? 'primary' : 'secondary'} 
                                      size="small"
                                    />
                                  </TableCell>
                                  <TableCell>
                                    {sealTagTimestamps && sealTagTimestamps[tagId] && (
                                      <Typography variant="caption">
                                        {new Date(sealTagTimestamps[tagId]).toLocaleString()}
                                      </Typography>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    {session.images && session.images.sealingImages && session.images.sealingImages[index] && (
                                      <Box 
                                        component="img" 
                                        src={session.images.sealingImages[index]} 
                                        alt={`Seal tag ${tagId}`}
                                        sx={{ 
                                          width: 40, 
                                          height: 40, 
                                          objectFit: 'cover',
                                          borderRadius: 1,
                                          cursor: 'pointer'
                                        }}
                                        onClick={() => {
                                          // Open image in new tab
                                          window.open(session.images?.sealingImages?.[index], '_blank');
                                        }}
                                      />
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </Box>
                      </>
                    );
                  }
                  
                  return <Typography variant="body2">No seal tag information available.</Typography>;
                })()}
              </Box>
            ) : (
              <>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                    <Typography variant="body2">
                      <strong>Seal Barcode:</strong> {session.seal.barcode}
                    </Typography>
                  </Box>
                  {session.seal.verified && (
                    <>
                      <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                        <Typography variant="body2">
                          <strong>Verification Date:</strong> {formatDate(session.seal.scannedAt || '')}
                        </Typography>
                      </Box>
                      {session.seal.verifiedBy && (
                        <Box sx={{ flex: '1 0 45%', minWidth: '250px' }}>
                          <Typography variant="body2">
                            <strong>Verified By:</strong> {session.seal.verifiedBy.name}
                          </Typography>
                        </Box>
                      )}
                    </>
                  )}
                </Box>
              </>
            )}
          </Box>
        )}
      </Paper>
    );
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
            </Box>
          </Box>
        )}

        {/* Field Verification Summary - Always show for completed sessions with verified seal */}
        {session.status === SessionStatus.COMPLETED && session.seal?.verified && (
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

      {/* Comment section - moved after verification results */}
      <CommentSection sessionId={sessionId} />
    </Container>
  );
}
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

      {/* Verification Results */}
      {renderVerificationResults()}
    </Container>
  );
} 
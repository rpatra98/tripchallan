'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  Typography, 
  Box, 
  CircularProgress,
  Alert
} from '@mui/material';

// Check if we're in a browser environment with camera capabilities
const isBrowserEnvironmentWithCamera = () => {
  return (
    typeof window !== 'undefined' && 
    typeof navigator !== 'undefined' && 
    !!navigator.mediaDevices && 
    !!navigator.mediaDevices.getUserMedia
  );
};

// Log wrapper for debugging client-side issues
const logClientInfo = (message: string) => {
  console.log(`[ClientScanner] ${message}`);
};

// Dynamically import the BasicQrScanner component with no SSR
const BasicQrScanner = dynamic(() => import('./BasicQrScanner'), { 
  ssr: false,
  loading: () => (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
      <CircularProgress />
      <Typography variant="body2" sx={{ ml: 2 }}>
        Loading scanner...
      </Typography>
    </Box>
  )
});

interface ClientSideQrScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title?: string;
}

export default function ClientSideQrScanner(props: ClientSideQrScannerProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [hasMediaDevices, setHasMediaDevices] = useState(false);

  // Only render on client-side and check for camera capabilities
  useEffect(() => {
    logClientInfo('Component mounted');
    setIsMounted(true);
    
    // Check if browser supports camera access
    const hasCamera = isBrowserEnvironmentWithCamera();
    setHasMediaDevices(hasCamera);
    
    if (!hasCamera) {
      logClientInfo('Camera not supported in this environment');
    } else {
      logClientInfo('Camera support detected');
    }
  }, []);

  if (!isMounted) {
    return (
      <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{props.title || "Scan QR/Barcode"}</DialogTitle>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
            <CircularProgress />
            <Typography variant="body2" sx={{ ml: 2 }}>
              Initializing...
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={props.onClose} color="primary">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
  
  if (!hasMediaDevices) {
    return (
      <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{props.title || "Scan QR/Barcode"}</DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography fontWeight="medium">Camera access not supported</Typography>
            <Typography variant="body2">
              Your browser doesn't support camera access, or you've denied permission.
              Please try using a different browser or check your browser settings.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={props.onClose} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    );
  }

  return <BasicQrScanner {...props} />;
} 
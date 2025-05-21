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

// Dynamically import the QrScanner component with no SSR
const QrScanner = dynamic(() => import('./QrScanner'), { 
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

  // Only render on client-side
  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{props.title || "Scan QR/Barcode"}</DialogTitle>
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
            <CircularProgress />
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

  return <QrScanner {...props} />;
} 
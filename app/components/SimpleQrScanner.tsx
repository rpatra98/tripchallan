"use client";

import React, { useEffect, useRef } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, IconButton, Alert } from '@mui/material';
import { Close } from '@mui/icons-material';
import { Html5Qrcode } from 'html5-qrcode';

interface SimpleQrScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title?: string;
}

const SimpleQrScanner: React.FC<SimpleQrScannerProps> = ({
  open,
  onClose,
  onScan,
  title = "Scan QR Code"
}) => {
  const scannerContainerId = "simple-qr-reader";
  const scanner = useRef<Html5Qrcode | null>(null);
  const initialized = useRef(false);
  const [error, setError] = React.useState<string | null>(null);

  // Initialize the scanner when the component mounts and the dialog is open
  useEffect(() => {
    if (!open) return;

    // Add a short delay to ensure the DOM is ready
    const initTimer = setTimeout(() => {
      initializeScanner();
    }, 300);
    
    return () => {
      clearTimeout(initTimer);
      cleanupScanner();
    };
  }, [open]);

  const initializeScanner = async () => {
    try {
      setError(null);
      
      // Make sure we start clean
      cleanupScanner();
      
      // Create a new scanner instance
      scanner.current = new Html5Qrcode(scannerContainerId);
      initialized.current = true;

      // Get camera device IDs
      const devices = await Html5Qrcode.getCameras();
      
      if (devices && devices.length > 0) {
        // Use the first camera
        await startScanner(devices[0].id);
      } else {
        setError("No cameras found. Please ensure camera permissions are granted.");
      }
    } catch (err) {
      console.error("Error initializing scanner:", err);
      setError("Could not access camera. Please ensure camera permissions are granted and try again.");
      scanner.current = null;
      initialized.current = false;
    }
  };

  const startScanner = async (cameraId: string) => {
    if (!scanner.current) {
      console.error("Scanner not initialized");
      setError("Scanner not initialized. Please try again.");
      return;
    }
    
    try {
      // Make sure we're starting with a clean state
      try {
        // Only try to stop if the scanner has a getState method and is actually scanning
        if (scanner.current.getState && scanner.current.getState() === 1) { // 1 = SCANNING
          await scanner.current.stop();
        }
      } catch (stopErr) {
        // If we can't stop it, log the error but continue
        console.warn("Warning when stopping scanner:", stopErr);
      }
      
      const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      };

      await scanner.current.start(
        cameraId, 
        config,
        (decodedText) => {
          // Successfully scanned QR code
          handleScan(decodedText);
        },
        (errorMessage) => {
          // This is called frequently when no QR code is detected
          // We don't need to handle these errors
        }
      );
    } catch (err) {
      console.error("Error starting scanner:", err);
      setError("Failed to start scanner. Please try again.");
      initialized.current = false;
    }
  };

  const handleScan = (data: string) => {
    try {
      cleanupScanner();
      onScan(data);
    } catch (err) {
      console.error("Error in handleScan:", err);
      // Still deliver the scan result even if cleanup fails
      onScan(data);
    }
  };

  const cleanupScanner = () => {
    if (scanner.current) {
      try {
        // Only try to stop if the scanner has a getState method and is actually scanning
        if (scanner.current.getState && scanner.current.getState() === 1) { // 1 = SCANNING
          scanner.current.stop().catch(err => {
            console.error("Error stopping scanner:", err);
          });
        }
      } catch (err) {
        console.error("Error during scanner cleanup:", err);
      }
    }
  };

  const handleRetry = () => {
    cleanupScanner();
    initialized.current = false;
    scanner.current = null;
    setTimeout(() => {
      initializeScanner();
    }, 300);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {title}
        <IconButton onClick={onClose} edge="end" size="small">
          <Close />
        </IconButton>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={handleRetry}>
                Try again
              </Button>
            }
          >
            {error}
          </Alert>
        )}
        
        <Box 
          id={scannerContainerId}
          sx={{ 
            width: '100%', 
            height: 300,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            border: '1px solid #ddd',
            borderRadius: 1,
            position: 'relative',
            overflow: 'hidden'
          }}
        />
        
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Position the QR code in the center of the frame
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Your browser might not fully support QR scanning. Try using Google Chrome for best experience.
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SimpleQrScanner; 
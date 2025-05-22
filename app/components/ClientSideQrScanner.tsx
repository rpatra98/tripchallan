'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography, IconButton, Alert, CircularProgress } from '@mui/material';
import { Close, Cameraswitch } from '@mui/icons-material';

// Define interfaces for html5-qrcode since it might not have TypeScript definitions
interface Html5QrcodeResult {
  text: string;
  format: string;
}

enum Html5QrcodeScannerState {
  NOT_STARTED = 0,
  SCANNING = 1,
  PAUSED = 2
}

interface Html5QrcodeError {
  message: string;
}

// Define formats enum for QR code types
enum QrCodeFormats {
  QR_CODE = 0,
  EAN_13 = 3,
  CODE_39 = 4,
  CODE_128 = 5
}

// Define Html5Qrcode class interface
interface Html5QrcodeClass {
  start: (
    cameraId: string,
    config: {
      fps: number;
      qrbox: { width: number; height: number };
      aspectRatio: number;
      formatsToSupport: QrCodeFormats[];
    },
    onSuccess: (decodedText: string, result: Html5QrcodeResult) => void,
    onFailure: (errorMessage: string, error: Html5QrcodeError) => void
  ) => Promise<void>;
  stop: () => Promise<void>;
  getState: () => Html5QrcodeScannerState;
  clear: () => void;
}

interface ClientSideQrScannerProps {
  /**
   * Callback function when a QR code is scanned
   */
  onScan: (data: string) => void;
  
  /**
   * Text to display on the scan button
   */
  buttonText?: string;
  
  /**
   * Dialog title for the QR scanner modal
   */
  scannerTitle?: string;
  
  /**
   * Optional class name for styling
   */
  className?: string;
  
  /**
   * Variant for the scan button
   */
  buttonVariant?: 'text' | 'outlined' | 'contained';
}

/**
 * ClientSideQrScanner - A wrapper component that provides a button to open the QR scanner
 * and handles the client-side import of the actual scanner component.
 */
const ClientSideQrScanner: React.FC<ClientSideQrScannerProps> = ({
  onScan,
  buttonText = 'Scan QR Code',
  scannerTitle = 'Scan QR/Barcode',
  buttonVariant = 'contained',
}) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [currentCamera, setCurrentCamera] = useState<string | null>(null);
  const [scannerInitialized, setScannerInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const scanner = useRef<any>(null);
  const scannerContainerId = "qr-reader";

  const handleClose = () => {
    cleanupScanner();
    setOpen(false);
    setScannerInitialized(false);
  };

  const handleOpen = () => {
    setOpen(true);
    setError(null);
  };

  // Safely clean up the scanner
  const cleanupScanner = () => {
    if (scanner.current) {
      try {
        // Only try to stop if it's actually scanning
        if (scanner.current.getState && scanner.current.getState() === Html5QrcodeScannerState.SCANNING) {
          scanner.current.stop()
            .catch((error: Error) => console.error("Error stopping scanner:", error));
        }
      } catch (err) {
        console.error("Error during scanner cleanup:", err);
      }
    }
  };

  const resetScanner = () => {
    cleanupScanner();
    scanner.current = null;
    setScannerInitialized(false);
    setTimeout(() => {
      initializeScanner();
    }, 300);
  };

  const initializeScanner = async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Ensure scanner is properly cleaned up before initializing a new one
      cleanupScanner();
      
      // Dynamically import html5-qrcode
      const Html5QrcodeModule = await import('html5-qrcode');
      const Html5Qrcode = Html5QrcodeModule.Html5Qrcode;
      
      // Create a new scanner instance
      scanner.current = new Html5Qrcode(scannerContainerId);

      // Get all cameras
      const devices = await Html5Qrcode.getCameras();
      
      if (devices && devices.length > 0) {
        // Sort cameras to prioritize rear cameras on mobile
        const sortedDevices = sortCamerasByFacingMode(devices);
        setCameras(sortedDevices);
        
        // If no camera is selected yet, prefer the rear (environment) camera if available
        if (!currentCamera) {
          // Try to find a camera that's likely to be a rear-facing camera
          const rearCamera = sortedDevices.find(camera => 
            camera.label.toLowerCase().includes('back') || 
            camera.label.toLowerCase().includes('rear') || 
            camera.label.toLowerCase().includes('environment')
          );
          
          setCurrentCamera(rearCamera ? rearCamera.id : sortedDevices[0].id);
          await startScanner(rearCamera ? rearCamera.id : sortedDevices[0].id);
        } else {
          await startScanner(currentCamera);
        }
      } else {
        setError("No cameras found. Please ensure camera permissions are granted.");
      }
    } catch (err) {
      console.error("Error initializing scanner:", err);
      setError("Could not access camera. Please ensure camera permissions are granted and try again.");
      scanner.current = null;
    } finally {
      setIsLoading(false);
    }
  };

  // Sort cameras to prioritize rear cameras on mobile devices
  const sortCamerasByFacingMode = (cameras: Array<{ id: string; label: string }>) => {
    return [...cameras].sort((a, b) => {
      const aLabel = a.label.toLowerCase();
      const bLabel = b.label.toLowerCase();
      
      // Check for common keywords used in camera labels
      const aIsRear = 
        aLabel.includes('back') || 
        aLabel.includes('rear') || 
        aLabel.includes('environment') ||
        !aLabel.includes('front');
      
      const bIsRear = 
        bLabel.includes('back') || 
        bLabel.includes('rear') || 
        bLabel.includes('environment') ||
        !bLabel.includes('front');
      
      if (aIsRear && !bIsRear) return -1; // a is rear, b is not - a comes first
      if (!aIsRear && bIsRear) return 1;  // b is rear, a is not - b comes first
      return 0; // both are the same type
    });
  };

  const startScanner = async (cameraId: string) => {
    if (!scanner.current) {
      console.error("Scanner not initialized");
      setError("Scanner not initialized. Please try again.");
      return;
    }
    
    try {
      setIsLoading(true);
      
      // Make sure we're starting with a clean state
      try {
        // Only try to stop if it's actually scanning
        if (scanner.current.getState && scanner.current.getState() === Html5QrcodeScannerState.SCANNING) {
          await scanner.current.stop();
          // Add a small delay to allow for cleanup
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (stopErr) {
        // If we can't stop it, log the error but continue
        console.warn("Warning when stopping scanner:", stopErr);
      }
      
      const config = { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        formatsToSupport: [
          QrCodeFormats.QR_CODE,
          QrCodeFormats.EAN_13,
          QrCodeFormats.CODE_39,
          QrCodeFormats.CODE_128
        ]
      };

      await scanner.current.start(
        cameraId, 
        config,
        (decodedText: string) => {
          // On successful scan
          handleScanSuccess(decodedText);
        },
        (errorMessage: string) => {
          // On error, we don't need to do anything since this callback 
          // is called frequently when no QR code is in view
        }
      );
      
      setScannerInitialized(true);
      setCurrentCamera(cameraId);
    } catch (err: unknown) {
      console.error("Error starting scanner:", err);
      if (err instanceof Error) {
        setError(`Scanner error: ${err.message}`);
      } else {
        setError("Failed to start scanner. Please try again.");
      }
      setScannerInitialized(false);
    } finally {
      setIsLoading(false);
    }
  };

  const switchCamera = async () => {
    if (cameras.length <= 1) return;
    setIsLoading(true);
    
    try {
      // First clean up the current scanner
      cleanupScanner();
      
      // Recreate the scanner instance to avoid issues
      const Html5QrcodeModule = await import('html5-qrcode');
      const Html5Qrcode = Html5QrcodeModule.Html5Qrcode;
      scanner.current = new Html5Qrcode(scannerContainerId);
      
      // Find the next camera in the list
      const currentIndex = cameras.findIndex(camera => camera.id === currentCamera);
      const nextIndex = (currentIndex + 1) % cameras.length;
      const nextCameraId = cameras[nextIndex].id;
      
      // Start the new camera
      await startScanner(nextCameraId);
    } catch (err) {
      console.error("Error switching camera:", err);
      setError("Failed to switch camera. Please try again.");
      resetScanner();
    }
  };

  const handleScanSuccess = (decodedText: string) => {
    try {
      // Stop the scanner
      if (scanner.current) {
        scanner.current.stop()
          .then(() => {
            // Close the dialog and call the onScan callback
            setOpen(false);
            setScannerInitialized(false);
            onScan(decodedText);
          })
          .catch((error: Error) => {
            console.error("Error stopping scanner after successful scan:", error);
            // Still call onScan even if there was an error stopping
            setOpen(false);
            setScannerInitialized(false);
            onScan(decodedText);
          });
      } else {
        // Call onScan even if scanner is not available
        setOpen(false);
        setScannerInitialized(false);
        onScan(decodedText);
      }
    } catch (err) {
      console.error("Error in handleScanSuccess:", err);
      // Ensure we still deliver the scan result
      setOpen(false);
      setScannerInitialized(false);
      onScan(decodedText);
    }
  };

  // Initialize scanner when dialog opens
  useEffect(() => {
    if (open && !scannerInitialized) {
      // Small timeout to ensure the DOM element is ready
      const timer = setTimeout(() => {
        initializeScanner();
      }, 300);
      
      return () => clearTimeout(timer);
    }
  }, [open, scannerInitialized]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupScanner();
    };
  }, []);

  return (
    <>
      <Button 
        variant={buttonVariant} 
        onClick={handleOpen}
        fullWidth
        sx={{ height: '56px' }}
      >
        {buttonText}
      </Button>
      
      <Dialog 
        open={open} 
        onClose={handleClose} 
        maxWidth="sm" 
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {scannerTitle}
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent>
          {error && (
            <Alert 
              severity="error" 
              sx={{ mb: 2 }}
              action={
                <Button color="inherit" size="small" onClick={resetScanner}>
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
          >
            {isLoading && (
              <Box 
                sx={{ 
                  position: 'absolute', 
                  top: 0, 
                  left: 0, 
                  right: 0, 
                  bottom: 0, 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.7)',
                  zIndex: 10
                }}
              >
                <CircularProgress />
              </Box>
            )}
          </Box>
          
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Position the QR code in the center of the frame
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Your browser might not fully support QR scanning. Try using Google Chrome for best experience.
            </Typography>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
          {cameras.length > 1 && (
            <Button 
              startIcon={<Cameraswitch />} 
              onClick={switchCamera}
              disabled={!scannerInitialized || isLoading}
            >
              Switch Camera
            </Button>
          )}
          <Button onClick={handleClose} color="primary">
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default ClientSideQrScanner; 
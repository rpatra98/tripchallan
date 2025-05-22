'use client';

import React, { useState, useCallback } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography, IconButton, Alert, Box, Divider, Stack } from '@mui/material';
import { Close, Cameraswitch, FlashOn, FlashOff, Upload } from '@mui/icons-material';
import { Html5Qrcode } from 'html5-qrcode';

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
  
  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);
  
  const handleScan = useCallback((data: string) => {
    onScan(data);
    setOpen(false);
  }, [onScan]);

  return (
    <>
      <Button 
        variant={buttonVariant} 
        onClick={() => setOpen(true)}
        fullWidth
        sx={{ height: '56px' }}
      >
        {buttonText}
      </Button>
      
      {open && (
        <QrScannerDialog 
          open={open}
          onClose={handleClose}
          onScan={handleScan}
          title={scannerTitle}
        />
      )}
    </>
  );
};

interface QrScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title: string;
}

const QrScannerDialog: React.FC<QrScannerDialogProps> = ({
  open,
  onClose,
  onScan,
  title
}) => {
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchActive, setTorchActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const scannerRef = React.useRef<any>(null);
  const scannerContainerId = "html5-qrcode-scanner";
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  React.useEffect(() => {
    let scanner: any = null;
    
    const initScanner = async () => {
      try {
        setError(null);
        
        if (!scanner) {
          scanner = new Html5Qrcode(scannerContainerId);
          scannerRef.current = scanner;
        }
        
        // Get all available cameras
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
          // Sort cameras to prioritize back camera (environment facing)
          const sortedDevices = sortCamerasByFacingMode(devices);
          setCameras(sortedDevices);
          
          // Start with the first camera (usually back camera after sorting)
          await startScanner(scanner, sortedDevices[0].id);
          
          // Check if torch is available
          checkTorchAvailability();
        } else {
          setError("No camera found. Please make sure your camera is connected and you've granted permission to use it.");
        }
      } catch (err) {
        console.error('Error initializing scanner:', err);
        setError("Could not access camera. Please ensure camera permissions are granted.");
      }
    };
    
    // Check if torch/flashlight is available
    const checkTorchAvailability = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getSupportedConstraints) {
        setTorchAvailable(false);
        return;
      }
      
      // First method: check constraints
      const supportedConstraints = navigator.mediaDevices.getSupportedConstraints();
      if (supportedConstraints && (supportedConstraints as any)['torch']) {
        setTorchAvailable(true);
        return;
      }
      
      // Second method: try to check if the scanner library has torch capability
      try {
        if (scannerRef.current && typeof (scannerRef.current as any).hasFlash === 'function') {
          const hasFlash = await (scannerRef.current as any).hasFlash();
          setTorchAvailable(hasFlash);
          return;
        }
      } catch (err) {
        console.warn('Error checking flash capability:', err);
      }
      
      // Last resort: on many Android devices, we can assume torch is available
      // if it's a rear-facing camera on a mobile device
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        const cameraLabel = cameras[currentCameraIndex]?.label.toLowerCase() || '';
        const isRearCamera = 
          cameraLabel.includes('back') || 
          cameraLabel.includes('rear') || 
          cameraLabel.includes('environment');
        
        if (isRearCamera) {
          setTorchAvailable(true);
          return;
        }
      }
      
      setTorchAvailable(false);
    };
    
    // Sort cameras to prioritize back cameras on mobile
    const sortCamerasByFacingMode = (cameras: Array<{ id: string; label: string }>) => {
      return [...cameras].sort((a, b) => {
        const aLabel = a.label.toLowerCase();
        const bLabel = b.label.toLowerCase();
        
        // Check for common keywords used in camera labels
        const aIsRear = 
          aLabel.includes('back') || 
          aLabel.includes('rear') || 
          aLabel.includes('environment');
        
        const bIsRear = 
          bLabel.includes('back') || 
          bLabel.includes('rear') || 
          bLabel.includes('environment');
        
        if (aIsRear && !bIsRear) return -1; // a is rear, b is not - a comes first
        if (!aIsRear && bIsRear) return 1;  // b is rear, a is not - b comes first
        return 0; // both are the same type
      });
    };
    
    const startScanner = async (scanner: any, cameraId: string) => {
      try {
        setIsScanning(true);
        
        await scanner.start(
          cameraId, 
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          (decodedText: string) => {
            onScan(decodedText);
          },
          () => {}
        );
      } catch (err) {
        console.error('Error starting scanner:', err);
        setError("Failed to start scanner. Please try again.");
        setIsScanning(false);
      }
    };
    
    if (open) {
      // Short delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initScanner();
      }, 300);
      
      return () => {
        clearTimeout(timer);
        if (scanner) {
          try {
            scanner.stop().catch((err: any) => {
              console.warn('Error stopping scanner:', err);
            });
          } catch (err) {
            console.warn('Error stopping scanner:', err);
          }
        }
      };
    }
    
    return undefined;
  }, [open, onScan]);
  
  const handleRetry = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().catch((err: any) => {
          console.warn('Error stopping scanner:', err);
        });
        scannerRef.current = null;
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
    }
    
    setTimeout(() => {
      setError(null);
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;
      
      Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
          const sortedDevices = devices.sort((a, b) => {
            const aLabel = a.label.toLowerCase();
            const bLabel = b.label.toLowerCase();
            
            const aIsRear = 
              aLabel.includes('back') || 
              aLabel.includes('rear') || 
              aLabel.includes('environment');
            
            const bIsRear = 
              bLabel.includes('back') || 
              bLabel.includes('rear') || 
              bLabel.includes('environment');
            
            if (aIsRear && !bIsRear) return -1;
            if (!aIsRear && bIsRear) return 1;
            return 0;
          });
          
          setCameras(sortedDevices);
          const cameraId = sortedDevices[0].id;
          
          scanner.start(
            cameraId, 
            {
              fps: 10,
              qrbox: { width: 250, height: 250 }
            },
            (decodedText: string) => {
              onScan(decodedText);
            },
            () => {}
          ).catch(err => {
            console.error('Error starting scanner:', err);
            setError("Failed to start scanner. Please try again.");
          });
        } else {
          setError("No camera found. Please make sure your camera is connected and you've granted permission to use it.");
        }
      }).catch(err => {
        console.error('Error getting cameras:', err);
        setError("Could not access cameras. Please ensure camera permissions are granted.");
      });
    }, 300);
  };
  
  const handleSwitchCamera = async () => {
    if (cameras.length <= 1) return;
    
    try {
      // Stop current scanner
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch (err) {
          console.warn('Error stopping scanner during camera switch:', err);
        }
      }
      
      // Switch to next camera
      const nextCameraIndex = (currentCameraIndex + 1) % cameras.length;
      setCurrentCameraIndex(nextCameraIndex);
      
      // Create a new scanner instance for reliability
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;
      
      // Reset torch state when switching camera
      setTorchActive(false);
      
      // Start scanner with new camera
      await scanner.start(
        cameras[nextCameraIndex].id,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText: string) => {
          onScan(decodedText);
        },
        () => {}
      );
    } catch (err) {
      console.error('Error switching camera:', err);
      setError("Failed to switch camera. Please try again.");
      handleRetry();
    }
  };
  
  const toggleTorch = async () => {
    if (!scannerRef.current) return;
    
    try {
      // Get the scanner's video element
      let videoElement: HTMLVideoElement | null = null;
      try {
        // Try to find the video element created by Html5Qrcode
        videoElement = document.querySelector(`#${scannerContainerId} video`);
        if (!videoElement) {
          throw new Error("Video element not found");
        }
      } catch (error) {
        console.error("Error finding video element:", error);
      }
      
      if (videoElement && videoElement.srcObject) {
        // Get video tracks from the video element
        const stream = videoElement.srcObject as MediaStream;
        const videoTrack = stream.getVideoTracks()[0];
        
        if (videoTrack) {
          // Toggle torch directly on the track
          const capabilities = videoTrack.getCapabilities();
          // Check if torch is supported in this track's capabilities
          if (capabilities && (capabilities as any).torch) {
            // Apply the torch constraint
            const torchValue = !torchActive;
            await videoTrack.applyConstraints({
              advanced: [{ torch: torchValue } as any]
            });
            setTorchActive(torchValue);
            return; // Success
          }
        }
      }
      
      // Fallback method 1: Try using scanner's methods
      if (typeof (scannerRef.current as any).getRunningTrack === 'function') {
        const videoTrack = (scannerRef.current as any).getRunningTrack();
        if (videoTrack) {
          const newTorchValue = !torchActive;
          await videoTrack.applyConstraints({
            advanced: [{ torch: newTorchValue } as any]
          });
          setTorchActive(newTorchValue);
          return; // Success
        }
      }
      
      // Fallback method 2: Try the toggleFlash method
      if (typeof (scannerRef.current as any).toggleFlash === 'function') {
        await (scannerRef.current as any).toggleFlash();
        setTorchActive(!torchActive);
        return; // Success
      }
      
      // If we've reached here, none of the methods worked
      throw new Error("Could not toggle flashlight with any available method");
      
    } catch (err) {
      console.error('Error toggling torch:', err);
      setError("Failed to toggle flashlight. Make sure to grant camera permissions and try again.");
      setTorchActive(false);
    }
  };
  
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setUploadError(null);
    
    // Create a new scanner if needed
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode(scannerContainerId);
    }
    
    // Scan the file
    scannerRef.current.scanFile(file, true)
      .then((decodedText: string) => {
        onScan(decodedText);
      })
      .catch((error: any) => {
        console.error("Error scanning file:", error);
        setUploadError("Could not scan the image. Make sure it contains a valid QR code or barcode.");
      });
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
        <IconButton onClick={onClose} size="small">
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
        
        {uploadError && (
          <Alert 
            severity="error" 
            sx={{ mb: 2 }}
            onClose={() => setUploadError(null)}
          >
            {uploadError}
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
        
        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Or upload an image containing a QR code/barcode:
          </Typography>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
            ref={fileInputRef}
          />
          <Button
            variant="outlined"
            startIcon={<Upload />}
            onClick={() => fileInputRef.current?.click()}
            fullWidth
            sx={{ mt: 1 }}
          >
            Upload Image
          </Button>
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
        <Stack direction="row" spacing={1}>
          {cameras.length > 1 && (
            <Button 
              startIcon={<Cameraswitch />} 
              onClick={handleSwitchCamera}
              size="small"
            >
              Switch Camera
            </Button>
          )}
          
          {torchAvailable && (
            <Button
              startIcon={torchActive ? <FlashOff /> : <FlashOn />}
              onClick={toggleTorch}
              size="small"
            >
              {torchActive ? 'Turn Off Flash' : 'Turn On Flash'}
            </Button>
          )}
        </Stack>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClientSideQrScanner; 
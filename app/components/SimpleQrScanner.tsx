"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, IconButton, Alert, Divider, Stack } from '@mui/material';
import { Close, Cameraswitch, FlashOn, FlashOff, Upload } from '@mui/icons-material';
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
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [torchActive, setTorchActive] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  const scannerRef = React.useRef<any>(null);
  const scannerContainerId = "simple-qr-reader";
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  
  // Initialize the scanner when the component mounts and the dialog is open
  useEffect(() => {
    let scanner: any = null;
    
    const initScanner = async () => {
      try {
        setError(null);
        
        if (!scannerRef.current) {
          scanner = new Html5Qrcode(scannerContainerId);
          scannerRef.current = scanner;
        } else {
          scanner = scannerRef.current;
        }
        
        // Get camera device IDs
        const devices = await Html5Qrcode.getCameras();
        
        if (devices && devices.length > 0) {
          // Sort cameras to prioritize back camera (environment facing)
          const sortedDevices = sortCamerasByFacingMode(devices);
          setCameras(sortedDevices);
          
          // Start with the first camera (usually back camera after sorting)
          const cameraId = sortedDevices[0].id;
          
          await scanner.start(
            cameraId, 
            {
              fps: 10,
              qrbox: { width: 250, height: 250 }
            },
            (decodedText: string) => {
              handleScan(decodedText);
            },
            () => {}
          );
          
          // Check if torch is available
          checkTorchAvailability();
        } else {
          setError("No cameras found. Please ensure camera permissions are granted.");
        }
      } catch (err) {
        console.error("Error initializing scanner:", err);
        setError("Could not access camera. Please ensure camera permissions are granted and try again.");
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
        // Simply check if the method exists, don't try to call it
        if (scannerRef.current && (scannerRef.current as any).hasFlash) {
          // Assume it might work on a mobile device with rear camera
          setTorchAvailable(true);
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
    
    if (open) {
      // Short delay to ensure DOM is ready
      const timer = setTimeout(() => {
        initScanner();
      }, 300);
      
      return () => {
        clearTimeout(timer);
        cleanup();
      };
    }
    
    return undefined;
  }, [open, onScan]);
  
  const cleanup = () => {
    if (scannerRef.current) {
      try {
        scannerRef.current.stop().catch((err: any) => {
          console.warn('Error stopping scanner:', err);
        });
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
    }
  };

  const handleScan = (data: string) => {
    cleanup();
    onScan(data);
  };

  const handleRetry = async () => {
    cleanup();
    scannerRef.current = null;
    
    setTimeout(async () => {
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
              handleScan(decodedText);
            },
            () => {}
          ).catch(err => {
            console.error('Error starting scanner:', err);
            setError("Failed to start scanner. Please try again.");
          });
          
          // Check torch availability again
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
          
          // Second method: try to check if the scanner has torch capability
          try {
            // Simply check if the method exists, don't try to call it
            if (scanner && (scanner as any).hasFlash) {
              // Assume it might work on a mobile device with rear camera
              setTorchAvailable(true);
              return;
            }
          } catch (err) {
            console.warn('Error checking flash capability during retry:', err);
          }
          
          // Last resort: check for mobile + rear camera
          const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
          if (isMobile) {
            const cameraLabel = sortedDevices[0]?.label.toLowerCase() || '';
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
          handleScan(decodedText);
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
        handleScan(decodedText);
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

export default SimpleQrScanner; 
'use client';

import React, { useState, useCallback } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography, IconButton, Alert, Box } from '@mui/material';
import { Close, Cameraswitch } from '@mui/icons-material';
import { Html5Qrcode } from 'html5-qrcode';

interface ClientSideQrScannerProps {
  /**
   * Callback function when a QR code is scanned
   */
  onScan?: (data: string) => void;
  
  /**
   * Callback function when a QR code is scanned with image
   */
  onScanWithImage?: (data: string, imageFile: File) => void;
  
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
  onScanWithImage,
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
    if (onScan) onScan(data);
    setOpen(false);
  }, [onScan]);

  const handleScanWithImage = useCallback((data: string, imageFile: File) => {
    if (onScanWithImage) onScanWithImage(data, imageFile);
    setOpen(false);
  }, [onScanWithImage]);

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
          onScan={onScan ? handleScan : undefined}
          onScanWithImage={onScanWithImage ? handleScanWithImage : undefined}
          title={scannerTitle}
        />
      )}
    </>
  );
};

interface QrScannerDialogProps {
  open: boolean;
  onClose: () => void;
  onScan?: (data: string) => void;
  onScanWithImage?: (data: string, imageFile: File) => void;
  title: string;
}

const QrScannerDialog: React.FC<QrScannerDialogProps> = ({
  open,
  onClose,
  onScan,
  onScanWithImage,
  title
}) => {
  const [error, setError] = useState<string | null>(null);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  
  const scannerRef = React.useRef<any>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const scannerContainerId = "html5-qrcode-scanner";
  
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
        } else {
          setError("No camera found. Please make sure your camera is connected and you've granted permission to use it.");
        }
      } catch (err) {
        console.error('Error initializing scanner:', err);
        setError("Could not access camera. Please ensure camera permissions are granted.");
      }
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
            // Capture the image from the video feed
            if (onScanWithImage) {
              captureFrame(decodedText);
            } else if (onScan) {
              onScan(decodedText);
            }
          },
          () => {}
        );

        // Get reference to the video element created by the scanner
        setTimeout(() => {
          const videoElement = document.querySelector('#' + scannerContainerId + ' video') as HTMLVideoElement;
          if (videoElement) {
            videoRef.current = videoElement;
          }
        }, 1000); // Give the scanner time to set up the video
      } catch (err) {
        console.error('Error starting scanner:', err);
        setError("Failed to start scanner. Please try again.");
        setIsScanning(false);
      }
    };

    // Function to capture a frame from the video as an image
    const captureFrame = (decodedText: string) => {
      try {
        if (!videoRef.current) {
          // Try to find the video element if not already set
          const videoElement = document.querySelector('#' + scannerContainerId + ' video') as HTMLVideoElement;
          if (!videoElement) {
            console.error('Video element not found');
            if (onScan) {
              onScan(decodedText);
            }
            return;
          }
          videoRef.current = videoElement;
        }

        // Create a canvas element if it doesn't exist
        if (!canvasRef.current) {
          const canvas = document.createElement('canvas');
          canvasRef.current = canvas;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw the current video frame to the canvas
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          // Convert canvas to blob
          canvas.toBlob((blob) => {
            if (blob && onScanWithImage) {
              // Create a file from the blob
              const imageFile = new File([blob], `qr-scan-${Date.now()}.jpg`, { type: 'image/jpeg' });
              onScanWithImage(decodedText, imageFile);
            } else if (onScan) {
              onScan(decodedText);
            }
          }, 'image/jpeg', 0.8);
        } else if (onScan) {
          onScan(decodedText);
        }
      } catch (error) {
        console.error('Error capturing frame:', error);
        if (onScan) {
          onScan(decodedText);
        }
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
  }, [open, onScan, onScanWithImage]);
  
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
      
      <DialogActions sx={{ justifyContent: 'space-between', px: 3, pb: 2 }}>
        {cameras.length > 1 && (
          <Button 
            startIcon={<Cameraswitch />} 
            onClick={handleSwitchCamera}
            size="small"
          >
            Switch Camera
          </Button>
        )}
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClientSideQrScanner; 
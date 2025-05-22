'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import type { BarcodeDetectorConstructor } from '../../types/barcode-detector';

// Simple function to detect QR codes in a video frame
const detectQRCode = async (videoElement: HTMLVideoElement, canvas: HTMLCanvasElement): Promise<string | null> => {
  if (!videoElement || !canvas) return null;
  
  const context = canvas.getContext('2d');
  if (!context) return null;
  
  try {
    // Draw the current video frame on the canvas
    context.drawImage(
      videoElement,
      0, 0,
      canvas.width, canvas.height
    );
    
    // Try to access the BarcodeDetector API if available
    if ('BarcodeDetector' in window) {
      try {
        const barcodeDetector = new (window.BarcodeDetector as BarcodeDetectorConstructor)({
          formats: ['qr_code']
        });
        
        const barcodes = await barcodeDetector.detect(canvas);
        if (barcodes.length > 0) {
          console.log('QR code detected:', barcodes[0].rawValue);
          return barcodes[0].rawValue;
        }
      } catch (error) {
        console.error('Error detecting barcode:', error);
      }
    }
  } catch (err) {
    console.error('Error processing video frame:', err);
  }
  
  return null;
};

interface BasicQrScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title?: string;
}

export default function BasicQrScanner({ open, onClose, onScan, title = "Scan QR/Barcode" }: BasicQrScannerProps) {
  // Initialize component state
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // Create refs for managing resources
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameProcessorRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Track if the component is mounted
  useEffect(() => {
    console.log('Component mounted');
    setIsMounted(true);
    return () => {
      console.log('Component unmounting');
      setIsMounted(false);
    };
  }, []);
  
  // Clean up resources when component unmounts or dialog closes
  const stopCamera = useCallback(() => {
    console.log('Stopping camera');
    if (frameProcessorRef.current) {
      cancelAnimationFrame(frameProcessorRef.current);
      frameProcessorRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        console.log('Stopping track:', track.kind, track.label, track.readyState);
        track.stop();
      });
      streamRef.current = null;
    }
    
    // Clear video source
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Process video frames to detect QR codes
  const processVideoFrame = useCallback(async () => {
    if (!open || !videoRef.current || !canvasRef.current) return;
    
    try {
      const code = await detectQRCode(videoRef.current, canvasRef.current);
      if (code) {
        setScanning(true);
        // Add a short delay to show scanning animation
        setTimeout(() => {
          onScan(code);
          setScanning(false);
          onClose();
        }, 500);
        return;
      }
    } catch (err) {
      console.error('Error processing frame:', err);
    }
    
    // Continue processing frames
    frameProcessorRef.current = requestAnimationFrame(processVideoFrame);
  }, [open, onClose, onScan]);

  // Start camera with the given constraints
  const startCameraWithConstraints = useCallback(async (constraints: MediaStreamConstraints) => {
    try {
      if (!videoRef.current) {
        console.error('Video element not available when starting camera');
        setError('Could not initialize video element. Please try again later.');
        setCameraLoading(false);
        return false;
      }
      
      console.log('Requesting camera with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Camera access granted, stream tracks:', stream.getTracks().length);
      
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      
      return new Promise<boolean>((resolve) => {
        if (!videoRef.current) {
          console.error('Video element lost after getting stream');
          resolve(false);
          return;
        }
        
        // Set up metadata event
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          if (!videoRef.current || !canvasRef.current) {
            console.error('Refs lost after metadata loaded');
            resolve(false);
            return;
          }
          
          // Set canvas dimensions
          canvasRef.current.width = videoRef.current.videoWidth || 640;
          canvasRef.current.height = videoRef.current.videoHeight || 480;
          
          // Start playback
          videoRef.current.play()
            .then(() => {
              console.log('Video playback started');
              if (frameProcessorRef.current === null) {
                frameProcessorRef.current = requestAnimationFrame(processVideoFrame);
              }
              resolve(true);
            })
            .catch(playError => {
              console.error('Failed to start video playback:', playError);
              resolve(false);
            });
        };
        
        // Handle errors
        videoRef.current.onerror = () => {
          console.error('Video element error');
          resolve(false);
        };
      });
    } catch (err) {
      console.error('Error accessing camera:', err);
      
      // Check if permission was denied
      if (err instanceof DOMException && 
         (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setPermissionDenied(true);
        setError('Camera access denied. Please allow camera access to scan codes.');
      } else {
        setError(`Camera error: ${err instanceof Error ? err.message : String(err)}`);
      }
      
      return false;
    }
  }, [processVideoFrame]);

  // Initialize camera with fallback options
  const initializeCamera = useCallback(async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Your browser doesn't support camera access");
      setCameraLoading(false);
      return;
    }

    // Check if we're on a secure origin (required for camera access in modern browsers)
    const isSecureOrigin = window.location.protocol === 'https:' || 
                          window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1';
    
    if (!isSecureOrigin) {
      console.warn('Camera access may fail: Not running on a secure origin. Camera access requires HTTPS (except on localhost).');
      setError('Camera access requires a secure connection (HTTPS). Please use a secure connection or contact support.');
      setCameraLoading(false);
      return;
    }
    
    console.log('Initializing camera, video element exists:', !!videoRef.current);
    
    // Try with detailed constraints first
    const detailedConstraints = {
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };
    
    let success = await startCameraWithConstraints(detailedConstraints);
    
    // If detailed constraints fail, try with simpler ones
    if (!success) {
      console.log('Detailed constraints failed, trying simpler ones');
      success = await startCameraWithConstraints({ video: true, audio: false });
    }
    
    // Update UI based on result
    if (success) {
      setCameraLoading(false);
    } else if (!error) {
      // Only set error if it hasn't been set by other functions
      setError('Could not initialize camera. Please try again.');
      setCameraLoading(false);
    }
  }, [error, startCameraWithConstraints]);

  // Handle dialog open/close
  useEffect(() => {
    console.log('Dialog open state changed:', open, 'Component mounted:', isMounted);
    
    if (!open) {
      stopCamera();
      return;
    }
    
    // Reset state
    setCameraLoading(true);
    setError(null);
    setPermissionDenied(false);
    
    // Add a small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      console.log('Starting camera after timeout, video element exists:', !!videoRef.current);
      if (isMounted) {
        initializeCamera();
      }
    }, 300);
    
    return () => {
      clearTimeout(timer);
      stopCamera();
    };
  }, [open, stopCamera, initializeCamera, isMounted]);

  // Attempt to switch cameras
  const handleSwitchCamera = useCallback(async () => {
    stopCamera();
    setCameraLoading(true);
    setError(null);
    
    try {
      // Try front camera if we were using back, and vice versa
      const currentFacingMode = streamRef.current?.getVideoTracks()[0]?.getSettings()?.facingMode;
      const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
      
      const success = await startCameraWithConstraints({
        video: { facingMode: { ideal: newFacingMode } },
        audio: false
      });
      
      if (!success && !error) {
        setError('Failed to switch camera. Please try again.');
      }
      
      setCameraLoading(false);
    } catch (err) {
      console.error('Error switching camera:', err);
      setError('Failed to switch camera. Please try again.');
      setCameraLoading(false);
    }
  }, [stopCamera, startCameraWithConstraints, error]);

  // Render scanner UI
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { overflow: 'hidden' } // Fix potential scrolling issues
      }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ p: 2 }}>
        {cameraLoading ? (
          <Box display="flex" flexDirection="column" justifyContent="center" alignItems="center" minHeight="300px">
            <CircularProgress size={60} />
            <Typography variant="body1" sx={{ mt: 2 }}>
              Accessing camera...
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Please allow camera access when prompted
            </Typography>
          </Box>
        ) : error ? (
          <Box sx={{ py: 2 }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
            
            {permissionDenied && (
              <Typography variant="body2" sx={{ mt: 2 }}>
                Please check your browser settings to enable camera access.
                <Box component="ul" sx={{ mt: 1, pl: 2 }}>
                  <li>In Chrome: Click the camera icon in the address bar</li>
                  <li>In Safari: Check Settings {`>`} Safari {`>`} Camera</li>
                  <li>In Firefox: Click the camera icon in the address bar</li>
                </Box>
              </Typography>
            )}
            
            <Button 
              variant="contained" 
              color="primary" 
              onClick={() => {
                console.log('Try Again clicked');
                stopCamera();
                setCameraLoading(true);
                setError(null);
                setPermissionDenied(false);
                
                // Small delay to ensure DOM updates
                setTimeout(() => {
                  initializeCamera();
                }, 300);
              }}
              sx={{ mt: 2 }}
            >
              Try Again
            </Button>
          </Box>
        ) : (
          <Box sx={{ position: 'relative' }}>
            <Box sx={{ 
              position: 'relative', 
              width: '100%', 
              maxWidth: '100%',
              height: 'auto',
              aspectRatio: '4/3',
              overflow: 'hidden',
              borderRadius: 1,
              bgcolor: '#000',
              border: '1px solid rgba(0,0,0,0.1)',
            }}>
              <video
                ref={videoRef}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  display: 'block'
                }}
                playsInline
                muted
                autoPlay
                key="qr-scanner-video"
              />
              
              <canvas 
                ref={canvasRef} 
                style={{ display: 'none', position: 'absolute', left: 0, top: 0 }}
                key="qr-scanner-canvas"
              />
              
              {/* QR code targeting frame */}
              <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '70%',
                height: '70%',
                border: '2px solid #fff',
                borderRadius: 1,
                boxShadow: '0 0 0 4000px rgba(0, 0, 0, 0.3)',
                zIndex: 10
              }} />
            </Box>
            
            {scanning && (
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
                  zIndex: 20
                }}
              >
                <CircularProgress />
              </Box>
            )}
            
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Position the QR code in the center of the frame
              </Typography>
              
              {!('BarcodeDetector' in window) && (
                <Alert severity="warning" sx={{ mb: 2, mt: 1, fontSize: '0.8rem' }}>
                  Your browser might not fully support QR scanning. Try using Google Chrome for best experience.
                </Alert>
              )}
              
              <Button 
                onClick={handleSwitchCamera} 
                variant="outlined" 
                size="small"
                sx={{ mt: 1 }}
              >
                Switch Camera
              </Button>
            </Box>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
} 
'use client';

import React, { useState, useEffect, useRef } from 'react';
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
        const barcodeDetector = new window.BarcodeDetector({
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
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameProcessorRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  // Clean up resources when component unmounts or dialog closes
  const stopCamera = () => {
    console.log('Stopping camera');
    if (frameProcessorRef.current) {
      cancelAnimationFrame(frameProcessorRef.current);
      frameProcessorRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  // Process video frames to detect QR codes
  const processVideoFrame = async () => {
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
  };
  
  // Attempt to switch cameras
  const handleSwitchCamera = async () => {
    stopCamera();
    setCameraLoading(true);
    
    try {
      // Try front camera if we were using back, and vice versa
      const currentFacingMode = streamRef.current?.getVideoTracks()[0]?.getSettings()?.facingMode;
      const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: newFacingMode } },
        audio: false
      });
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Update canvas size
        if (canvasRef.current) {
          canvasRef.current.width = videoRef.current.videoWidth || 640;
          canvasRef.current.height = videoRef.current.videoHeight || 480;
        }
        
        setCameraLoading(false);
        frameProcessorRef.current = requestAnimationFrame(processVideoFrame);
      }
    } catch (err) {
      console.error('Error switching camera:', err);
      setError('Failed to switch camera. Please try again.');
      setCameraLoading(false);
    }
  };
  
  // Initialize camera when dialog opens
  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    
    setCameraLoading(true);
    setError(null);
    setPermissionDenied(false);
    
    // Check if camera access is supported
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Your browser doesn't support camera access");
      setCameraLoading(false);
      return;
    }
    
    // Immediately initialize camera
    const startCamera = async () => {
      try {
        console.log('Requesting camera permission...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
        
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          
          // Make sure video element has correct size settings
          videoRef.current.style.width = '100%';
          videoRef.current.style.height = '100%';
          
          // Start scanning once video is playing
          videoRef.current.onloadedmetadata = () => {
            console.log('Video metadata loaded, size:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
            
            if (canvasRef.current) {
              canvasRef.current.width = videoRef.current?.videoWidth || 640;
              canvasRef.current.height = videoRef.current?.videoHeight || 480;
            }
            
            videoRef.current?.play().then(() => {
              console.log('Video playback started');
              setCameraLoading(false);
              frameProcessorRef.current = requestAnimationFrame(processVideoFrame);
            }).catch(error => {
              console.error('Failed to play video:', error);
              setError('Failed to start camera. Please try again.');
              setCameraLoading(false);
            });
          };
        }
      } catch (err) {
        console.error('Camera access error:', err);
        
        // Check if permission was denied
        if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
          setPermissionDenied(true);
          setError('Camera access denied. Please allow camera access to scan codes.');
        } else {
          setError(`Camera error: ${err instanceof Error ? err.message : String(err)}`);
        }
        
        setCameraLoading(false);
      }
    };
    
    startCamera();
    
    return () => {
      stopCamera();
    };
  }, [open, onClose, onScan]);
  
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
                  <li>In Safari: Check Settings > Safari > Camera</li>
                  <li>In Firefox: Click the camera icon in the address bar</li>
                </Box>
              </Typography>
            )}
            
            <Button 
              variant="contained" 
              color="primary" 
              onClick={() => {
                stopCamera();
                setCameraLoading(true);
                setError(null);
                setPermissionDenied(false);
                
                // Try to start camera again
                navigator.mediaDevices.getUserMedia({
                  video: { facingMode: 'environment' },
                  audio: false
                }).then(stream => {
                  streamRef.current = stream;
                  if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.play().then(() => {
                      setCameraLoading(false);
                      frameProcessorRef.current = requestAnimationFrame(processVideoFrame);
                    });
                  }
                }).catch(err => {
                  console.error('Failed to restart camera:', err);
                  setError('Could not access camera. Please try again.');
                  setCameraLoading(false);
                });
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
                  objectFit: 'cover'
                }}
                playsInline
                muted
                autoPlay
              />
              
              <canvas 
                ref={canvasRef} 
                style={{ display: 'none' }} 
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
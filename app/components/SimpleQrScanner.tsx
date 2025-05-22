'use client';

import React, { useState, useEffect } from 'react';
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

interface SimpleQrScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title?: string;
}

export default function SimpleQrScanner({ open, onClose, onScan, title = "Scan QR/Barcode" }: SimpleQrScannerProps) {
  // Basic state
  const [error, setError] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(true);
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  // DOM element references (not React refs)
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [canvasElement, setCanvasElement] = useState<HTMLCanvasElement | null>(null);
  
  // Camera state
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [frameProcessorId, setFrameProcessorId] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  
  // Cleanup function to stop the camera and release resources
  const stopCamera = () => {
    console.log('Stopping camera');
    
    // Stop frame processing
    if (frameProcessorId !== null) {
      cancelAnimationFrame(frameProcessorId);
      setFrameProcessorId(null);
    }
    
    // Stop all tracks
    if (stream) {
      stream.getTracks().forEach(track => {
        console.log(`Stopping ${track.kind} track`);
        track.stop();
      });
      setStream(null);
    }
    
    // Clear video source
    if (videoElement) {
      videoElement.srcObject = null;
    }
  };
  
  // Create and initialize elements when dialog opens
  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    
    // Reset state
    setCameraLoading(true);
    setError(null);
    setPermissionDenied(false);
    
    // Wait for next frame to ensure DOM is ready
    const timerId = setTimeout(() => {
      // Create video element
      const video = document.createElement('video');
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.display = 'block';
      video.playsInline = true;
      video.muted = true;
      video.autoplay = true;
      video.id = 'qr-video-' + Math.random().toString(36).substring(2, 9);
      
      // Create canvas element
      const canvas = document.createElement('canvas');
      canvas.style.display = 'none';
      canvas.width = 640;
      canvas.height = 480;
      canvas.id = 'qr-canvas-' + Math.random().toString(36).substring(2, 9);
      
      // Store elements in state
      setVideoElement(video);
      setCanvasElement(canvas);
      
      console.log('Elements created:', video.id, canvas.id);
      
      // Get video container element
      const container = document.getElementById('qr-video-container');
      if (!container) {
        console.error('Video container not found');
        setError('Could not initialize scanner. Please try again.');
        setCameraLoading(false);
        return;
      }
      
      // Clear container and append elements
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      container.appendChild(video);
      container.appendChild(canvas);
      
      // Start camera after elements are in the DOM
      startCamera();
    }, 300);
    
    return () => {
      clearTimeout(timerId);
      stopCamera();
    };
  }, [open]);
  
  // Function to start the camera
  const startCamera = async () => {
    if (!videoElement || !canvasElement) {
      console.error('Video or canvas element not available');
      setError('Could not initialize video. Please try again.');
      setCameraLoading(false);
      return;
    }
    
    try {
      // Check if on secure context
      if (window.location.protocol !== 'https:' && 
          window.location.hostname !== 'localhost' && 
          window.location.hostname !== '127.0.0.1') {
        setError('Camera access requires a secure connection (HTTPS)');
        setCameraLoading(false);
        return;
      }
      
      // Check for camera support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Your browser does not support camera access');
        setCameraLoading(false);
        return;
      }
      
      // Try to get camera access with preferred settings
      let cameraStream: MediaStream;
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
      } catch (initialError) {
        console.warn('Failed with detailed constraints, trying simple ones');
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }
      
      // Store stream and connect to video element
      setStream(cameraStream);
      videoElement.srcObject = cameraStream;
      
      // Start video playback when ready
      videoElement.onloadedmetadata = () => {
        console.log('Video metadata loaded');
        
        // Update canvas dimensions
        canvasElement.width = videoElement.videoWidth || 640;
        canvasElement.height = videoElement.videoHeight || 480;
        
        // Start playback
        videoElement.play()
          .then(() => {
            console.log('Video playback started');
            setCameraLoading(false);
            startFrameProcessing();
          })
          .catch(err => {
            console.error('Failed to play video:', err);
            setError('Could not start video playback. Please try again.');
            setCameraLoading(false);
          });
      };
      
      // Handle video errors
      videoElement.onerror = (event) => {
        console.error('Video element error:', event);
        setError('Video element error. Please try again.');
        setCameraLoading(false);
      };
      
    } catch (err) {
      console.error('Camera access error:', err);
      
      if (err instanceof DOMException && 
         (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setPermissionDenied(true);
        setError('Camera access denied. Please allow camera access to scan codes.');
      } else {
        setError(`Camera error: ${err instanceof Error ? err.message : String(err)}`);
      }
      
      setCameraLoading(false);
    }
  };
  
  // Process video frames to detect QR codes
  const startFrameProcessing = () => {
    if (!videoElement || !canvasElement || !open) return;
    
    const detectQRCodeInFrame = async () => {
      if (!videoElement || !canvasElement || !open) return;
      
      try {
        // Draw current video frame on canvas
        const context = canvasElement.getContext('2d');
        if (!context) return;
        
        context.drawImage(
          videoElement,
          0, 0,
          canvasElement.width, canvasElement.height
        );
        
        // Try to detect QR code
        if ('BarcodeDetector' in window) {
          try {
            // @ts-ignore - BarcodeDetector API
            const barcodeDetector = new window.BarcodeDetector({
              formats: ['qr_code']
            });
            
            const barcodes = await barcodeDetector.detect(canvasElement);
            if (barcodes.length > 0) {
              console.log('QR code detected:', barcodes[0].rawValue);
              
              // Success! Show scanning animation and return result
              setScanning(true);
              setTimeout(() => {
                onScan(barcodes[0].rawValue);
                setScanning(false);
                onClose();
              }, 500);
              return;
            }
          } catch (error) {
            console.error('Error detecting barcode:', error);
          }
        }
      } catch (err) {
        console.error('Error processing frame:', err);
      }
      
      // Continue scanning
      const frameId = requestAnimationFrame(detectQRCodeInFrame);
      setFrameProcessorId(frameId);
    };
    
    // Start the frame processor
    const frameId = requestAnimationFrame(detectQRCodeInFrame);
    setFrameProcessorId(frameId);
  };
  
  // Switch between front and back cameras
  const handleSwitchCamera = async () => {
    stopCamera();
    setCameraLoading(true);
    
    if (!videoElement) {
      console.error('Video element not available for camera switch');
      setError('Could not switch camera. Please try again.');
      setCameraLoading(false);
      return;
    }
    
    try {
      // Get current facing mode
      const currentFacingMode = stream?.getVideoTracks()[0]?.getSettings()?.facingMode;
      const newFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
      
      // Request new stream
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: newFacingMode } },
        audio: false
      });
      
      // Apply new stream
      setStream(newStream);
      videoElement.srcObject = newStream;
      
      // Wait for it to load
      videoElement.onloadedmetadata = () => {
        videoElement.play()
          .then(() => {
            setCameraLoading(false);
            startFrameProcessing();
          })
          .catch(err => {
            console.error('Failed to play video after switch:', err);
            setError('Could not start video playback. Please try again.');
            setCameraLoading(false);
          });
      };
    } catch (err) {
      console.error('Error switching camera:', err);
      setError('Failed to switch camera. Please try again.');
      setCameraLoading(false);
    }
  };
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={{
        sx: { overflow: 'hidden' }
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
                // Retry
                stopCamera();
                setCameraLoading(true);
                setError(null);
                setPermissionDenied(false);
                
                setTimeout(() => {
                  startCamera();
                }, 300);
              }}
              sx={{ mt: 2 }}
            >
              Try Again
            </Button>
          </Box>
        ) : (
          <Box sx={{ position: 'relative' }}>
            <Box 
              id="qr-video-container"
              sx={{ 
                position: 'relative', 
                width: '100%', 
                maxWidth: '100%',
                height: 'auto',
                aspectRatio: '4/3',
                overflow: 'hidden',
                borderRadius: 1,
                bgcolor: '#000',
                border: '1px solid rgba(0,0,0,0.1)',
              }}
            >
              {/* Video and canvas will be added here dynamically */}
              
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
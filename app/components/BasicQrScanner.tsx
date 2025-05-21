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
  
  // Draw the current video frame on the canvas
  context.drawImage(
    videoElement,
    0, 0,
    canvas.width, canvas.height
  );
  
  // Try to access the BarcodeDetector API if available
  if ('BarcodeDetector' in window) {
    try {
      // @ts-ignore - BarcodeDetector is not yet in TypeScript's lib definitions
      const barcodeDetector = new window.BarcodeDetector({
        formats: ['qr_code']
      });
      
      const barcodes = await barcodeDetector.detect(canvas);
      if (barcodes.length > 0) {
        return barcodes[0].rawValue;
      }
    } catch (error) {
      console.error('Error detecting barcode:', error);
    }
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
  const [usingFallback, setUsingFallback] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameProcessorRef = useRef<number | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  
  // Clean up resources when component unmounts or dialog closes
  const stopCamera = () => {
    if (frameProcessorRef.current) {
      cancelAnimationFrame(frameProcessorRef.current);
      frameProcessorRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
  };
  
  // Set up and initialize the camera
  useEffect(() => {
    if (!open) {
      stopCamera();
      return;
    }
    
    setCameraLoading(true);
    setError(null);
    
    const startCamera = async () => {
      try {
        // First try to use the environment-facing camera (back camera)
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' }
          });
          mediaStreamRef.current = stream;
        } catch (err) {
          // If that fails, try any available camera
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
          mediaStreamRef.current = stream;
          setUsingFallback(true);
        }
        
        if (videoRef.current && mediaStreamRef.current) {
          videoRef.current.srcObject = mediaStreamRef.current;
          await videoRef.current.play();
          
          // Start processing frames
          const processFrame = async () => {
            if (!open) return;
            
            if (videoRef.current && canvasRef.current) {
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
            }
            
            // Continue processing frames
            frameProcessorRef.current = requestAnimationFrame(processFrame);
          };
          
          // Start processing
          frameProcessorRef.current = requestAnimationFrame(processFrame);
          setCameraLoading(false);
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        setError(`Couldn't access camera: ${err instanceof Error ? err.message : String(err)}`);
        setCameraLoading(false);
      }
    };
    
    startCamera();
    
    // Clean up when the dialog closes
    return () => {
      stopCamera();
    };
  }, [open, onClose, onScan]);
  
  const handleSwitchCamera = async () => {
    // Stop the current camera
    stopCamera();
    setCameraLoading(true);
    
    try {
      // Request opposite camera type
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: usingFallback ? 'environment' : 'user' }
      });
      
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        
        // Start processing frames again
        const processFrame = async () => {
          if (!open) return;
          
          if (videoRef.current && canvasRef.current) {
            const code = await detectQRCode(videoRef.current, canvasRef.current);
            if (code) {
              setScanning(true);
              setTimeout(() => {
                onScan(code);
                setScanning(false);
                onClose();
              }, 500);
              return;
            }
          }
          
          frameProcessorRef.current = requestAnimationFrame(processFrame);
        };
        
        frameProcessorRef.current = requestAnimationFrame(processFrame);
      }
      
      setUsingFallback(!usingFallback);
      setCameraLoading(false);
    } catch (err) {
      console.error('Error switching camera:', err);
      setError(`Couldn't switch camera: ${err instanceof Error ? err.message : String(err)}`);
      setCameraLoading(false);
    }
  };
  
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        {cameraLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : (
          <Box sx={{ position: 'relative' }}>
            <Box sx={{ 
              position: 'relative', 
              width: '100%', 
              maxWidth: '100%',
              height: 'auto',
              aspectRatio: '4/3',
              overflow: 'hidden',
              borderRadius: 1
            }}>
              <video
                ref={videoRef}
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: 'cover',
                  transform: usingFallback ? 'scaleX(-1)' : 'none' // Flip if using front camera
                }}
                playsInline
                muted
              />
              
              <canvas 
                ref={canvasRef} 
                width={640} 
                height={480} 
                style={{ display: 'none' }} 
              />
              
              {/* QR code targeting frame */}
              <Box sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '60%',
                height: '60%',
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
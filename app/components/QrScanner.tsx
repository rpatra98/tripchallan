'use client';

import React, { useState, useEffect } from 'react';
import QrReader from 'react-qr-scanner';
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

interface QrScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title?: string;
}

export default function QrScanner({ open, onClose, onScan, title = "Scan QR/Barcode" }: QrScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [cameraLoading, setCameraLoading] = useState(true);

  // Get available cameras when component mounts
  useEffect(() => {
    if (open) {
      setCameraLoading(true);
      setError(null);
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          const videoDevices = devices.filter(device => device.kind === 'videoinput');
          setCameras(videoDevices);
          if (videoDevices.length > 0) {
            // Default to the environment facing camera if available (better for QR codes)
            const envCamera = videoDevices.find(device => device.label.toLowerCase().includes('back'));
            setSelectedCamera(envCamera?.deviceId || videoDevices[0].deviceId);
          } else {
            setError("No cameras found on your device");
          }
          setCameraLoading(false);
        })
        .catch(err => {
          console.error('Error accessing media devices:', err);
          setError("Error accessing camera: " + err.message);
          setCameraLoading(false);
        });
    }
  }, [open]);

  const handleScan = (data: { text: string } | null) => {
    if (data && data.text) {
      setScanning(true);
      // Add a short delay to show scanning animation
      setTimeout(() => {
        onScan(data.text);
        setScanning(false);
        onClose();
      }, 500);
    }
  };

  const handleError = (err: Error) => {
    console.error('QR Scanner error:', err);
    setError("Scanning error: " + err.message);
  };

  // Switch camera function
  const handleSwitchCamera = () => {
    if (cameras.length <= 1) return;
    
    const currentIndex = cameras.findIndex(camera => camera.deviceId === selectedCamera);
    const nextIndex = (currentIndex + 1) % cameras.length;
    setSelectedCamera(cameras[nextIndex].deviceId);
  };

  // Camera component with configuration
  const previewStyle = {
    width: '100%',
    maxWidth: '100%',
    height: 'auto',
    maxHeight: '70vh',
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
            {selectedCamera && (
              <QrReader
                delay={300}
                style={previewStyle}
                onError={handleError}
                onScan={handleScan}
                constraints={{
                  video: {
                    deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                  }
                }}
              />
            )}
            
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
                  backgroundColor: 'rgba(255, 255, 255, 0.7)'
                }}
              >
                <CircularProgress />
              </Box>
            )}
            
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Position the QR code or barcode in the camera view to scan
              </Typography>
              
              {cameras.length > 1 && (
                <Button 
                  onClick={handleSwitchCamera} 
                  variant="outlined" 
                  size="small"
                  sx={{ mt: 1 }}
                >
                  Switch Camera
                </Button>
              )}
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
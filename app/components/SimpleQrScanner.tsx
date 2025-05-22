"use client";

import React, { useState, useEffect } from 'react';
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
  const [error, setError] = useState<string | null>(null);
  const scannerRef = React.useRef<any>(null);
  const scannerContainerId = "simple-qr-reader";
  
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
          const cameraId = devices[0].id;
          
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
        } else {
          setError("No cameras found. Please ensure camera permissions are granted.");
        }
      } catch (err) {
        console.error("Error initializing scanner:", err);
        setError("Could not access camera. Please ensure camera permissions are granted and try again.");
      }
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

  const handleRetry = () => {
    cleanup();
    scannerRef.current = null;
    
    setTimeout(() => {
      setError(null);
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;
      
      Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
          const cameraId = devices[0].id;
          
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
        } else {
          setError("No camera found. Please make sure your camera is connected and you've granted permission to use it.");
        }
      }).catch(err => {
        console.error('Error getting cameras:', err);
        setError("Could not access cameras. Please ensure camera permissions are granted.");
      });
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
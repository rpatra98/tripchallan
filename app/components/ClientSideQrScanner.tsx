'use client';

import React, { useState, useCallback } from 'react';
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, Typography, IconButton, Alert, Box } from '@mui/material';
import { Close } from '@mui/icons-material';
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
  const scannerRef = React.useRef<any>(null);
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
        
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length) {
          const cameraId = devices[0].id;
          
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
        } else {
          setError("No camera found. Please make sure your camera is connected and you've granted permission to use it.");
        }
      } catch (err) {
        console.error('Error initializing scanner:', err);
        setError("Could not access camera. Please ensure camera permissions are granted.");
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
          const cameraId = devices[0].id;
          
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
      
      <DialogActions>
        <Button onClick={onClose} color="primary">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClientSideQrScanner; 
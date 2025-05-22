'use client';

import React, { useState, useCallback } from 'react';
import { Button, Stack, Typography } from '@mui/material';
import QrCodeScannerIcon from '@mui/icons-material/QrCodeScanner';
import dynamic from 'next/dynamic';

// Types for the QR scanner props
interface QRScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (data: string) => void;
  title?: string;
}

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
   * Optional class name for styling
   */
  className?: string;
  
  /**
   * Variant for the scan button
   */
  buttonVariant?: 'text' | 'outlined' | 'contained';
}

// Dynamically import the SimpleQrScanner component with no SSR
const SimpleQrScanner = dynamic(() => import('./SimpleQrScanner'), {
  ssr: false,
  loading: () => <div>Loading scanner...</div>
});

/**
 * ClientSideQrScanner - A wrapper component that provides a button to open the QR scanner
 * and handles the client-side import of the actual scanner component.
 */
export default function ClientSideQrScanner({
  onScan,
  buttonText = "Scan QR Code",
  scannerTitle = "Scan QR/Barcode",
  className,
  buttonVariant = "contained"
}: ClientSideQrScannerProps) {
  // State to control the QR scanner dialog
  const [showScanner, setShowScanner] = useState(false);
  
  // Handler for opening the scanner
  const handleOpenScanner = useCallback(() => {
    setShowScanner(true);
  }, []);
  
  // Handler for closing the scanner
  const handleCloseScanner = useCallback(() => {
    setShowScanner(false);
  }, []);
  
  // Handler for when a QR code is successfully scanned
  const handleScan = useCallback((data: string) => {
    onScan(data);
    setShowScanner(false);
  }, [onScan]);
  
  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center" className={className}>
        <Button
          variant={buttonVariant}
          startIcon={<QrCodeScannerIcon />}
          onClick={handleOpenScanner}
        >
          {buttonText}
        </Button>
      </Stack>
      
      {/* Show the QR scanner when needed */}
      {showScanner && (
        <SimpleQrScanner
          open={showScanner}
          onClose={handleCloseScanner}
          onScan={handleScan}
          title={scannerTitle}
        />
      )}
    </>
  );
} 
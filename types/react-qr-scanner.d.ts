declare module 'react-qr-scanner' {
  import React from 'react';

  export interface QrReaderProps {
    delay?: number;
    style?: React.CSSProperties;
    onError: (error: Error) => void;
    onScan: (data: { text: string } | null) => void;
    constraints?: MediaTrackConstraints | { video: MediaTrackConstraints };
    className?: string;
    legacyMode?: boolean;
    facingMode?: 'user' | 'environment';
  }

  const QrReader: React.ComponentType<QrReaderProps>;
  export default QrReader;
} 
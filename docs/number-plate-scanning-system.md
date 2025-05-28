# Number Plate Scanning System Implementation

## 1. System Overview
Integration of number plate scanning using HTML5 Camera API into the existing GUARD verification system.

## 2. Current System Analysis
Based on the codebase structure:
- Next.js application with TypeScript
- Prisma for database management
- Role-based access control (SUPERADMIN, ADMIN, COMPANY, EMPLOYEE)
- Existing dashboard structure with companies, employees, and activity logs

## 3. Implementation Components

### 3.1 Frontend Routes
```
app/
  dashboard/
    scan/
      page.tsx                 # Main scanning interface
      [id]/
        page.tsx              # Detailed scan view
      history/
        page.tsx              # Scan history view
```

### 3.2 Components
```
components/
  scan/
    Scanner.tsx             # Camera interface
    PlateDisplay.tsx        # Scanned plate information
    ScanHistory.tsx         # History table component
    ScanVerification.tsx    # Verification status component
```

## 4. Core Implementation

### 4.1 Scanner Component (Scanner.tsx)
```typescript
import { useRef, useState, useEffect } from 'react';

interface ScannerProps {
  onScanComplete: (result: ScanResult) => void;
  companyId: string;
}

interface ScanResult {
  imageUrl: string;
  timestamp: Date;
  plateNumber?: string;  // Optional as it might need manual entry
}

const Scanner: React.FC<ScannerProps> = ({ onScanComplete, companyId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Start camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
        setError(null);
      }
    } catch (error) {
      setError('Camera access failed. Please check permissions.');
      console.error('Camera access failed:', error);
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
  };

  // Capture image
  const captureImage = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas && video) {
      const context = canvas.getContext('2d');
      if (context) {
        // Set canvas size to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        // Draw current video frame
        context.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        onScanComplete({
          imageUrl: imageData,
          timestamp: new Date()
        });
      }
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="scanner-container">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="camera-feed"
      />
      <canvas
        ref={canvasRef}
        style={{ display: 'none' }}
      />
      {error && <div className="error-message">{error}</div>}
      <div className="controls">
        {!isCameraActive ? (
          <button onClick={startCamera}>Start Camera</button>
        ) : (
          <>
            <button onClick={captureImage}>Capture</button>
            <button onClick={stopCamera}>Stop Camera</button>
          </>
        )}
      </div>
    </div>
  );
};
```

### 4.2 Plate Display Component (PlateDisplay.tsx)
```typescript
interface PlateDisplayProps {
  imageUrl: string;
  onPlateNumberSubmit: (plateNumber: string) => void;
}

const PlateDisplay: React.FC<PlateDisplayProps> = ({ 
  imageUrl, 
  onPlateNumberSubmit 
}) => {
  const [plateNumber, setPlateNumber] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onPlateNumberSubmit(plateNumber);
  };

  return (
    <div className="plate-display">
      <img src={imageUrl} alt="Captured plate" className="plate-image" />
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={plateNumber}
          onChange={(e) => setPlateNumber(e.target.value)}
          placeholder="Enter plate number"
          required
        />
        <button type="submit">Submit</button>
      </form>
    </div>
  );
};
```

## 5. Database Schema

```prisma
model VehicleScan {
  id          String   @id @default(cuid())
  plateNumber String
  imageUrl    String
  status      ScanStatus
  userId      String    // User who performed scan
  companyId   String    // Company associated with scan
  createdAt   DateTime  @default(now())
  notes       String?

  // Relations
  user        User      @relation(fields: [userId], references: [id])
  company     Company   @relation(fields: [companyId], references: [id])

  @@index([plateNumber])
  @@index([companyId])
  @@index([userId])
}

enum ScanStatus {
  PENDING
  VERIFIED
  REJECTED
}
```

## 6. API Implementation

### 6.1 Scan API (route.ts)
```typescript
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageUrl, plateNumber, companyId } = await req.json();

    const scan = await prisma.vehicleScan.create({
      data: {
        plateNumber,
        imageUrl,
        status: 'PENDING',
        userId: session.user.id,
        companyId
      }
    });

    return NextResponse.json(scan);
  } catch (error) {
    console.error('Scan creation failed:', error);
    return NextResponse.json(
      { error: 'Failed to create scan' },
      { status: 500 }
    );
  }
}
```

## 7. Integration with GUARD System

### 7.1 Activity Log Integration
```typescript
interface ScanActivityLog {
  type: 'PLATE_SCAN';
  plateNumber: string;
  scanId: string;
  status: ScanStatus;
  timestamp: Date;
  userId: string;
  companyId: string;
}
```

### 7.2 Verification Flow
1. Capture plate image
2. Manual plate number entry
3. Submit for verification
4. Update activity logs
5. Notify relevant parties

## 8. Error Handling

```typescript
interface ScanError {
  code: string;
  message: string;
  details?: any;
}

// Common error scenarios:
// - Camera access denied
// - Invalid image format
// - Database connection issues
// - Permission denied
```

## 9. Security Considerations

### 9.1 Access Control
```typescript
const scanPermissions = {
  SUPERADMIN: ['view', 'scan', 'verify', 'delete'],
  ADMIN: ['view', 'scan', 'verify'],
  COMPANY: ['view', 'scan'],
  EMPLOYEE: ['view']
};
```

### 9.2 Data Protection
- Secure image storage
- Input validation
- Rate limiting
- User authentication

## 10. Performance Optimizations

### 10.1 Image Processing
- Client-side image compression
- Efficient image storage
- Caching strategies

### 10.2 Database
- Indexed queries
- Efficient storage
- Pagination implementation

## 11. Browser Compatibility

### 11.1 Supported Browsers
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

### 11.2 Mobile Support
- iOS Safari
- Android Chrome
- Mobile Firefox

## 12. Development Guidelines

### 12.1 Code Standards
- Follow existing TypeScript patterns
- Maintain consistent error handling
- Document all new components
- Include unit tests

### 12.2 Testing Requirements
- Camera access testing
- Image capture testing
- Form validation
- Error handling
- Mobile responsiveness 
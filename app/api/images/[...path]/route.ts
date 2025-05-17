import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import fs from 'fs';
import path from 'path';
import { UserRole } from "@/prisma/enums";
import { getImageUrl } from "@/lib/cloudinary";

// Directory for storing uploaded files
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

// Create directory only in development, not in production (Vercel has read-only filesystem)
if (process.env.NODE_ENV !== 'production' && !fs.existsSync(UPLOAD_DIR)) {
  try {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  } catch (error) {
    console.error("Failed to create uploads directory:", error);
  }
}

export const GET = withAuth(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
    try {
      // Get path segments from the request URL
      const { path: pathArray } = context?.params || { path: [] };
      
      // Parse path parameters from the path array
      // The path array will contain segments like ['sessionId', 'imageType', 'index']
      if (!pathArray || !Array.isArray(pathArray) || pathArray.length < 2) {
        return NextResponse.json(
          { error: "Invalid path parameters. Expected /api/images/[sessionId]/[imageType]/[index]" },
          { status: 400 }
        );
      }
      
      const sessionId = pathArray[0];
      const imageType = pathArray[1];
      const index = pathArray.length > 2 ? pathArray[2] : null;

      // Get the session to verify it exists
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      // First check if we have any cloud URLs stored in activity logs
      if (process.env.NODE_ENV === 'production') {
        const imageActivityLog = await prisma.activityLog.findFirst({
          where: {
            targetResourceId: sessionId,
            targetResourceType: "session",
            action: "UPLOAD_IMAGES",
          },
          orderBy: {
            createdAt: 'desc',
          },
        });

        if (imageActivityLog?.details && typeof imageActivityLog.details === 'object') {
          const details = imageActivityLog.details as any;
          if (details.cloudinaryImageUrls) {
            const urls = details.cloudinaryImageUrls;
            
            // Determine which URL to return based on image type
            let imageUrl = null;
            if (imageType === 'gpsImei' && urls.gpsImeiPicture) {
              imageUrl = urls.gpsImeiPicture;
            } else if (imageType === 'vehicleNumber' && urls.vehicleNumberPlatePicture) {
              imageUrl = urls.vehicleNumberPlatePicture;
            } else if (imageType === 'driver' && urls.driverPicture) {
              imageUrl = urls.driverPicture;
            } else if (imageType === 'sealing' && urls.sealingImages) {
              // Handle array of images stored as comma-separated string
              const sealingUrls = urls.sealingImages.split(',');
              if (index !== null && sealingUrls.length > parseInt(index)) {
                imageUrl = sealingUrls[parseInt(index)];
              }
            } else if (imageType === 'vehicle' && urls.vehicleImages) {
              const vehicleUrls = urls.vehicleImages.split(',');
              if (index !== null && vehicleUrls.length > parseInt(index)) {
                imageUrl = vehicleUrls[parseInt(index)];
              }
            } else if (imageType === 'additional' && urls.additionalImages) {
              const additionalUrls = urls.additionalImages.split(',');
              if (index !== null && additionalUrls.length > parseInt(index)) {
                imageUrl = additionalUrls[parseInt(index)];
              }
            }
            
            // If we found a URL, redirect to it
            if (imageUrl) {
              return NextResponse.redirect(imageUrl);
            }
          }
        }
        
        // If we didn't find a stored URL, get a Cloudinary URL using the path pattern
        // This is a fallback for newer images that might follow a different pattern
        try {
          // Convert index to number or undefined (not null)
          const indexParam = index !== null ? parseInt(index) : undefined;
          const cloudinaryUrl = getImageUrl(sessionId, imageType, indexParam);
          return NextResponse.redirect(cloudinaryUrl);
        } catch (error) {
          console.error("Error getting Cloudinary URL:", error);
          // Fall through to placeholder image
        }
      }

      // In development, try to serve from local filesystem
      if (process.env.NODE_ENV !== 'production') {
        const filePath = index !== null 
          ? path.join(UPLOAD_DIR, sessionId, imageType, index) 
          : path.join(UPLOAD_DIR, sessionId, imageType);
        
        if (fs.existsSync(filePath)) {
          try {
            const imageBuffer = fs.readFileSync(filePath);
            // Determine content type based on extension or use a default
            const contentType = 'image/jpeg'; // You may need more sophisticated content type detection
            
            return new NextResponse(imageBuffer, {
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600',
              },
            });
          } catch (error) {
            console.error("Error reading local image:", error);
            // Fall through to placeholder
          }
        }
      }

      // Fallback to placeholder image if all else fails
      const placeholderImgPath = path.join(process.cwd(), 'public', 'file.svg');
      
      try {
        const imageBuffer = fs.readFileSync(placeholderImgPath);
        
        // Set appropriate content type
        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (error) {
        console.error("Error serving placeholder image:", error);
        // Return a simple SVG as fallback if file can't be read
        const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
          <rect width="100" height="100" fill="#f0f0f0"/>
          <text x="50" y="50" font-family="Arial" font-size="12" text-anchor="middle" dominant-baseline="middle" fill="#666">Image</text>
        </svg>`;
        
        return new NextResponse(svgContent, {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    } catch (error) {
      console.error("Error serving image:", error);
      // Return a simple SVG as fallback
      const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
        <rect width="100" height="100" fill="#f0f0f0"/>
        <text x="50" y="50" font-family="Arial" font-size="12" text-anchor="middle" dominant-baseline="middle" fill="#666">Error</text>
      </svg>`;
      
      return new NextResponse(svgContent, {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY, UserRole.EMPLOYEE]
); 
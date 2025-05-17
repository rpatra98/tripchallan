import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import fs from 'fs';
import path from 'path';
import { UserRole } from "@/prisma/enums";

// Directory for storing uploaded files (kept for backward compatibility)
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
    console.log("Image API request started");
    try {
      // Get path segments from the request URL
      const { path: pathArray } = context?.params || { path: [] };
      
      console.log(`Image path requested: ${Array.isArray(pathArray) ? pathArray.join('/') : pathArray}`);
      
      // Parse path parameters from the path array
      // The path array will contain segments like ['sessionId', 'imageType', 'index']
      if (!pathArray || !Array.isArray(pathArray) || pathArray.length < 2) {
        console.error(`Invalid path parameters: ${JSON.stringify(pathArray)}`);
        return NextResponse.json(
          { error: "Invalid path parameters. Expected /api/images/[sessionId]/[imageType]/[index]" },
          { status: 400 }
        );
      }
      
      const sessionId = pathArray[0];
      const imageType = pathArray[1];
      const index = pathArray.length > 2 ? pathArray[2] : null;

      console.log(`Retrieving image: Session ID: ${sessionId}, Image Type: ${imageType}${index !== null ? `, Index: ${index}` : ''}`);

      // Get the session to verify it exists
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        console.error(`Session not found: ${sessionId}`);
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      // Retrieve base64 image data from activity logs
      console.log("Searching for image in activity logs");
      const imageActivityLog = await prisma.activityLog.findFirst({
        where: {
          targetResourceId: sessionId,
          targetResourceType: "session",
          action: "STORE_IMAGES",
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (imageActivityLog?.details && typeof imageActivityLog.details === 'object') {
        console.log("Found activity log with image data");
        const details = imageActivityLog.details as any;
        if (details.imageBase64Data) {
          console.log("Found imageBase64Data in activity log");
          const imageData = details.imageBase64Data;
          
          // Determine which image data to return based on image type
          let base64Image = null;
          let contentType = 'image/jpeg'; // Default content type
          
          if (imageType === 'gpsImei' && imageData.gpsImeiPicture) {
            console.log("Returning GPS IMEI image");
            base64Image = imageData.gpsImeiPicture.data;
            contentType = imageData.gpsImeiPicture.contentType || contentType;
          } else if (imageType === 'vehicleNumber' && imageData.vehicleNumberPlatePicture) {
            console.log("Returning vehicle number plate image");
            base64Image = imageData.vehicleNumberPlatePicture.data;
            contentType = imageData.vehicleNumberPlatePicture.contentType || contentType;
          } else if (imageType === 'driver' && imageData.driverPicture) {
            console.log("Returning driver image");
            base64Image = imageData.driverPicture.data;
            contentType = imageData.driverPicture.contentType || contentType;
          } else if (imageType === 'sealing' && imageData.sealingImages && imageData.sealingImages.length > 0) {
            // Handle array of images
            if (index !== null && parseInt(index) < imageData.sealingImages.length) {
              console.log(`Returning sealing image at index ${index}`);
              const imageEntry = imageData.sealingImages[parseInt(index)];
              base64Image = imageEntry.data;
              contentType = imageEntry.contentType || contentType;
            } else {
              console.log(`Sealing image index not found: ${index}`);
            }
          } else if (imageType === 'vehicle' && imageData.vehicleImages && imageData.vehicleImages.length > 0) {
            if (index !== null && parseInt(index) < imageData.vehicleImages.length) {
              console.log(`Returning vehicle image at index ${index}`);
              const imageEntry = imageData.vehicleImages[parseInt(index)];
              base64Image = imageEntry.data;
              contentType = imageEntry.contentType || contentType;
            } else {
              console.log(`Vehicle image index not found: ${index}`);
            }
          } else if (imageType === 'additional' && imageData.additionalImages && imageData.additionalImages.length > 0) {
            if (index !== null && parseInt(index) < imageData.additionalImages.length) {
              console.log(`Returning additional image at index ${index}`);
              const imageEntry = imageData.additionalImages[parseInt(index)];
              base64Image = imageEntry.data;
              contentType = imageEntry.contentType || contentType;
            } else {
              console.log(`Additional image index not found: ${index}`);
            }
          } else {
            console.log(`Image type or index not found: ${imageType}${index !== null ? `[${index}]` : ''}`);
          }
          
          // If we found a base64 image, return it
          if (base64Image) {
            console.log("Converting base64 to image buffer");
            try {
              // Convert base64 to buffer
              const imageBuffer = Buffer.from(base64Image, 'base64');
              
              // Return image with appropriate content type
              console.log(`Returning image with content type: ${contentType}`);
              return new NextResponse(imageBuffer, {
                headers: {
                  'Content-Type': contentType,
                  'Cache-Control': 'public, max-age=3600',
                },
              });
            } catch (error) {
              console.error("Error processing base64 image:", error);
              // Fall through to next options
            }
          } else {
            console.log("No matching base64 image found in activity log");
          }
        } else {
          console.log("No imageBase64Data found in activity log details");
        }
      } else {
        console.log("No activity log found with image data");
      }

      // Try to serve from local filesystem (for backward compatibility)
      if (process.env.NODE_ENV !== 'production') {
        console.log("Attempting to read from local filesystem");
        const filePath = index !== null 
          ? path.join(UPLOAD_DIR, sessionId, imageType, index) 
          : path.join(UPLOAD_DIR, sessionId, imageType);
        
        console.log(`Looking for file at: ${filePath}`);
        if (fs.existsSync(filePath)) {
          try {
            console.log("File found, reading from disk");
            const imageBuffer = fs.readFileSync(filePath);
            // Determine content type based on extension or use a default
            const contentType = 'image/jpeg'; // You may need more sophisticated content type detection
            
            console.log(`Returning file from disk with content type: ${contentType}`);
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
        } else {
          console.log("File not found on disk");
        }
      }

      // Fallback to placeholder image if all else fails
      console.log("Using placeholder image as fallback");
      const placeholderImgPath = path.join(process.cwd(), 'public', 'file.svg');
      
      try {
        console.log(`Reading placeholder from: ${placeholderImgPath}`);
        const imageBuffer = fs.readFileSync(placeholderImgPath);
        
        // Set appropriate content type
        console.log("Returning placeholder SVG image");
        return new NextResponse(imageBuffer, {
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      } catch (error) {
        console.error("Error serving placeholder image:", error);
        // Return a simple SVG as fallback if file can't be read
        console.log("Generating inline SVG as ultimate fallback");
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
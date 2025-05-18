import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import fs from 'fs';
import path from 'path';
import { UserRole } from "@/prisma/enums";

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

      console.log(`Retrieving image for session ${sessionId}, type ${imageType}${index !== null ? `, index ${index}` : ''}`);

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

      // Try to get the image from the database
      // We need to find the activity log that contains the base64 image data
      // Get all activity logs for this session to ensure we find all data
      const allLogs = await prisma.activityLog.findMany({
        where: {
          targetResourceId: sessionId,
          targetResourceType: 'session',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      console.log(`Found ${allLogs.length} activity logs for session ${sessionId}`);
      
      // First, look for logs with direct imageBase64Data
      let activityLog = allLogs.find((log: any) => 
        log.details && 
        typeof log.details === 'object' && 
        (log.details as any).imageBase64Data
      );
      
      if (activityLog) {
        console.log(`Found activity log with imageBase64Data`);
      } else {
        console.log(`No logs with imageBase64Data found, searching for other logs that might contain images`);
        
        // If no logs have imageBase64Data, try any log with details (might have image paths)
        activityLog = allLogs.find((log: any) => 
          log.details && 
          typeof log.details === 'object'
        );
      }

      if (activityLog && activityLog.details) {
        console.log(`Processing activity log for session ${sessionId}`);
        const details = activityLog.details as any;
        
        // Check if this activity log contains imageBase64Data
        if (details.imageBase64Data) {
          console.log(`Activity log contains imageBase64Data`);
          let imageData = null;
          let contentType = 'image/jpeg';

          // Extract the correct image data based on the type and index
          if (imageType === 'gpsImei' && details.imageBase64Data.gpsImeiPicture) {
            imageData = details.imageBase64Data.gpsImeiPicture.data;
            contentType = details.imageBase64Data.gpsImeiPicture.contentType || contentType;
          } else if (imageType === 'vehicleNumber' && details.imageBase64Data.vehicleNumberPlatePicture) {
            imageData = details.imageBase64Data.vehicleNumberPlatePicture.data;
            contentType = details.imageBase64Data.vehicleNumberPlatePicture.contentType || contentType;
          } else if (imageType === 'driver' && details.imageBase64Data.driverPicture) {
            imageData = details.imageBase64Data.driverPicture.data;
            contentType = details.imageBase64Data.driverPicture.contentType || contentType;
          } else if (imageType === 'sealing' && details.imageBase64Data.sealingImages && index !== null) {
            const sealingImage = details.imageBase64Data.sealingImages[parseInt(index)];
            if (sealingImage) {
              imageData = sealingImage.data;
              contentType = sealingImage.contentType || contentType;
            }
          } else if (imageType === 'vehicle' && details.imageBase64Data.vehicleImages && index !== null) {
            const vehicleImage = details.imageBase64Data.vehicleImages[parseInt(index)];
            if (vehicleImage) {
              imageData = vehicleImage.data;
              contentType = vehicleImage.contentType || contentType;
            }
          } else if (imageType === 'additional' && details.imageBase64Data.additionalImages && index !== null) {
            const additionalImage = details.imageBase64Data.additionalImages[parseInt(index)];
            if (additionalImage) {
              imageData = additionalImage.data;
              contentType = additionalImage.contentType || contentType;
            }
          }

          if (imageData) {
            console.log(`Serving image data for ${imageType}${index !== null ? ` at index ${index}` : ''}`);
            // Convert base64 to buffer
            const buffer = Buffer.from(imageData, 'base64');
            
            // Return the image
            return new NextResponse(buffer, {
              headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
              },
            });
          } else {
            console.log(`No image data found for ${imageType}${index !== null ? ` at index ${index}` : ''}`);
          }
        } else {
          // Try to find image info in activity log details, even if not in imageBase64Data format
          console.log(`Activity log doesn't have imageBase64Data, but it might have image info`);
          
          // If this is a log that has direct image paths (from the first activity log)
          if (details.images) {
            console.log(`Activity log has image paths, but we need base64 data for direct serving`);
          }
          
          // Search all logs (including this one) for any field that might match the requested image
          const allImageFields = Object.keys(details);
          console.log(`Searching through fields: ${allImageFields.join(', ')}`);
          
          // Look for an object field that might contain our image data
          for (const field of allImageFields) {
            const value = details[field];
            
            // Skip if not an object or if we've already checked it
            if (!value || typeof value !== 'object' || field === 'imageBase64Data') continue;
            
            console.log(`Checking field "${field}" for image data`);
            
            // Check if this field has our image type
            if (imageType === 'gpsImei' && value.gpsImeiPicture) {
              console.log(`Found gpsImeiPicture in ${field}`);
              if (value.gpsImeiPicture.data) {
                const buffer = Buffer.from(value.gpsImeiPicture.data, 'base64');
                return new NextResponse(buffer, {
                  headers: {
                    'Content-Type': value.gpsImeiPicture.contentType || 'image/jpeg',
                    'Cache-Control': 'public, max-age=86400',
                  },
                });
              }
            }
            
            // Similar checks for other image types
            if (imageType === 'vehicleNumber' && value.vehicleNumberPlatePicture) {
              console.log(`Found vehicleNumberPlatePicture in ${field}`);
              if (value.vehicleNumberPlatePicture.data) {
                const buffer = Buffer.from(value.vehicleNumberPlatePicture.data, 'base64');
                return new NextResponse(buffer, {
                  headers: {
                    'Content-Type': value.vehicleNumberPlatePicture.contentType || 'image/jpeg',
                    'Cache-Control': 'public, max-age=86400',
                  },
                });
              }
            }
            
            // Check for driver picture
            if (imageType === 'driver' && value.driverPicture) {
              console.log(`Found driverPicture in ${field}`);
              if (value.driverPicture.data) {
                const buffer = Buffer.from(value.driverPicture.data, 'base64');
                return new NextResponse(buffer, {
                  headers: {
                    'Content-Type': value.driverPicture.contentType || 'image/jpeg',
                    'Cache-Control': 'public, max-age=86400',
                  },
                });
              }
            }
            
            // Check for array types
            if (imageType === 'sealing' && value.sealingImages && index !== null) {
              console.log(`Found sealingImages in ${field}`);
              const sealingImage = value.sealingImages[parseInt(index)];
              if (sealingImage && sealingImage.data) {
                const buffer = Buffer.from(sealingImage.data, 'base64');
                return new NextResponse(buffer, {
                  headers: {
                    'Content-Type': sealingImage.contentType || 'image/jpeg',
                    'Cache-Control': 'public, max-age=86400',
                  },
                });
              }
            }
          }
          
          console.log(`No suitable image data found in any field`);
        }
      }

      console.log(`No activity log or image data found, serving placeholder for session ${sessionId}`);
      
      // If no image data was found, serve a placeholder
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
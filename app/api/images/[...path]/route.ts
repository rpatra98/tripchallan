import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import fs from 'fs';
import path from 'path';
import { UserRole } from "@/prisma/enums";
import fsPromises from 'fs/promises';

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

/**
 * API route that serves images from the public directory with better error handling
 * This helps debug issues with missing or corrupted images
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Get the path segments
    const pathSegments = params.path || [];
    
    // Join the path segments to form the relative file path
    const relativePath = pathSegments.join('/');
    
    // Log what we're trying to serve
    console.log(`Serving image: ${relativePath}`);

    // Determine which type of image this is based on the path segments
    const sessionId = pathSegments[0];
    const imageType = pathSegments[1];
    let index = null;
    if (pathSegments.length > 2) {
      index = pathSegments[2];
    }

    // First try to get the image from the database
    try {
      // Verify the session exists
      const session = await prisma.session.findUnique({
        where: { id: sessionId },
      });

      if (!session) {
        console.error(`Session not found: ${sessionId}`);
        // Continue to file system fallback
      } else {
        // Find the activity logs for this session
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
          const details = activityLog.details as any;
          
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
            }
          }
        } else {
          // Try checking other logs for image data in different formats
          for (const log of allLogs) {
            if (!log.details || typeof log.details !== 'object') continue;
            
            const details = log.details as any;
            for (const field of Object.keys(details)) {
              const value = details[field];
              if (!value || typeof value !== 'object') continue;
              
              // Check if this field or any nested field has our image
              if (imageType === 'gpsImei' && value.gpsImeiPicture && value.gpsImeiPicture.data) {
                const buffer = Buffer.from(value.gpsImeiPicture.data, 'base64');
                return new NextResponse(buffer, {
                  headers: {
                    'Content-Type': value.gpsImeiPicture.contentType || 'image/jpeg',
                    'Cache-Control': 'public, max-age=86400',
                  },
                });
              } else if (imageType === 'vehicleNumber' && value.vehicleNumberPlatePicture && value.vehicleNumberPlatePicture.data) {
                const buffer = Buffer.from(value.vehicleNumberPlatePicture.data, 'base64');
                return new NextResponse(buffer, {
                  headers: {
                    'Content-Type': value.vehicleNumberPlatePicture.contentType || 'image/jpeg',
                    'Cache-Control': 'public, max-age=86400',
                  },
                });
              } else if (imageType === 'driver' && value.driverPicture && value.driverPicture.data) {
                const buffer = Buffer.from(value.driverPicture.data, 'base64');
                return new NextResponse(buffer, {
                  headers: {
                    'Content-Type': value.driverPicture.contentType || 'image/jpeg',
                    'Cache-Control': 'public, max-age=86400',
                  },
                });
              } else if (imageType === 'sealing' && value.sealingImages && index !== null) {
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
              } else if (imageType === 'vehicle' && value.vehicleImages && index !== null) {
                const vehicleImage = value.vehicleImages[parseInt(index)];
                if (vehicleImage && vehicleImage.data) {
                  const buffer = Buffer.from(vehicleImage.data, 'base64');
                  return new NextResponse(buffer, {
                    headers: {
                      'Content-Type': vehicleImage.contentType || 'image/jpeg',
                      'Cache-Control': 'public, max-age=86400',
                    },
                  });
                }
              } else if (imageType === 'additional' && value.additionalImages && index !== null) {
                const additionalImage = value.additionalImages[parseInt(index)];
                if (additionalImage && additionalImage.data) {
                  const buffer = Buffer.from(additionalImage.data, 'base64');
                  return new NextResponse(buffer, {
                    headers: {
                      'Content-Type': additionalImage.contentType || 'image/jpeg',
                      'Cache-Control': 'public, max-age=86400',
                    },
                  });
                }
              }
            }
          }
        }
      }
    } catch (dbError) {
      console.error(`Error retrieving image from database:`, dbError);
      // Continue to file system fallback
    }

    // If database retrieval failed, try to serve from the file system
    const filePath = path.join(process.cwd(), 'public', 'uploads', relativePath);
    
    try {
      // Check if the file exists
      const stats = await fsPromises.stat(filePath);
      
      if (!stats.isFile()) {
        console.error(`Image not a file: ${filePath}`);
        // Continue to fallback below
      } else {
        // Read the file
        const file = await fsPromises.readFile(filePath);
        
        // Determine content type based on file extension
        let contentType = 'application/octet-stream';
        if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
          contentType = 'image/jpeg';
        } else if (filePath.endsWith('.png')) {
          contentType = 'image/png';
        } else if (filePath.endsWith('.gif')) {
          contentType = 'image/gif';
        } else if (filePath.endsWith('.svg')) {
          contentType = 'image/svg+xml';
        } else if (filePath.endsWith('.webp')) {
          contentType = 'image/webp';
        }
        
        // Return the file with appropriate headers
        return new NextResponse(file, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Content-Length': stats.size.toString(),
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
    } catch (error) {
      console.error(`Error serving image ${filePath}:`, error);
      // Continue to fallback
    }

    // If we get here, either the file wasn't found or there was an error reading it.
    // Serve an appropriate default image based on the image type
    
    // Define paths for placeholder images based on type
    let placeholderPath;
    
    switch(imageType) {
      case 'driver':
        placeholderPath = path.join(process.cwd(), 'public', 'images', 'driver-placeholder.svg');
        break;
      case 'vehicleNumber':
        placeholderPath = path.join(process.cwd(), 'public', 'images', 'plate-placeholder.svg');
        break;
      case 'gpsImei':
        placeholderPath = path.join(process.cwd(), 'public', 'images', 'gps-placeholder.svg');
        break;
      case 'sealing':
      case 'vehicle':
      case 'additional':
      default:
        placeholderPath = path.join(process.cwd(), 'public', 'file.svg');
        break;
    }
    
    // Serve the placeholder image if it exists
    try {
      const exists = await fsPromises.stat(placeholderPath).then(() => true).catch(() => false);
      
      if (exists) {
        const placeholderFile = await fsPromises.readFile(placeholderPath);
        return new NextResponse(placeholderFile, {
          status: 200,
          headers: {
            'Content-Type': 'image/svg+xml',
            'Cache-Control': 'public, max-age=3600',
          },
        });
      }
    } catch (error) {
      console.error(`Error serving placeholder: ${placeholderPath}`, error);
    }
    
    // If we get here, even the placeholder couldn't be served, so generate a simple SVG
    const placeholderText = imageType === 'driver' ? 'Driver'
                          : imageType === 'vehicleNumber' ? 'Plate'
                          : imageType === 'gpsImei' ? 'GPS/IMEI'
                          : imageType === 'sealing' ? 'Seal'
                          : imageType === 'vehicle' ? 'Vehicle'
                          : 'Image';
    
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
      <rect width="200" height="150" fill="#f0f0f0"/>
      <rect x="5" y="5" width="190" height="140" fill="#e0e0e0" stroke="#cccccc" stroke-width="2"/>
      <text x="100" y="75" font-family="Arial" font-size="16" text-anchor="middle" dominant-baseline="middle" fill="#666">${placeholderText}</text>
    </svg>`;
    
    return new NextResponse(svgContent, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('Error in image API route:', error);
    
    // Return a simple SVG as a fallback
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
      <rect width="200" height="150" fill="#f0f0f0"/>
      <text x="100" y="75" font-family="Arial" font-size="16" text-anchor="middle" dominant-baseline="middle" fill="#666">Image Error</text>
    </svg>`;
    
    return new NextResponse(svgContent, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
}

export const GET_OLD = withAuth(
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
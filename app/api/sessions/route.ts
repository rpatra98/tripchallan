import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole, EmployeeSubrole } from "@/prisma/enums";
import { Prisma } from "@prisma/client";
import fs from 'fs';
import path from 'path';

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

// Helper function to save a single file from FormData
async function saveFormFile(file: File, filePath: string): Promise<void> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);
  } catch (error) {
    console.error(`Error saving file to ${filePath}:`, error);
    throw error;
  }
}

// Helper function to save multiple files from FormData
async function saveFormFilesArray(formData: FormData, prefix: string, dirPath: string): Promise<void> {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  
  for (const [key, value] of formData.entries()) {
    if (key.startsWith(prefix) && value instanceof File) {
      const index = key.match(/\[(\d+)\]/)?.[1] || '0';
      const filePath = path.join(dirPath, index);
      await saveFormFile(value, filePath);
    }
  }
}

// Helper function to convert File to base64
async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString('base64');
}

interface QueryOptions {
  skip: number;
  take: number;
  orderBy: { createdAt: "desc" };
  include: {
    createdBy: {
      select: {
        id: true;
        name: true;
        email: true;
        subrole: true;
      };
    };
    company: {
      select: {
        id: true;
        name: true;
      };
    };
    seal: true;
  };
  where?: Record<string, unknown>;
}

interface SessionWithSeal {
  id: string;
  source: string;
  destination: string;
  status: string;
  createdAt: Date;
  seal: {
    id: string;
    barcode: string;
    verified: boolean;
    scannedAt: Date | null;
  } | null;
}

interface ActivityLogDetails {
  tripDetails?: Record<string, unknown>;
  images?: Record<string, string>;
  timestamps?: Record<string, string>;
  qrCodes?: Record<string, string>;
  verification?: {
    status: string;
    timestamp: string;
    verifiedBy: string;
  };
}

async function handler(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }
    
    const userRole = session.user.role;
    const userId = session.user.id;
    
    // Get query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    
    // Build where clause based on user role
    let whereClause: Record<string, any> = {};
    
    try {
      if (userRole === UserRole.SUPERADMIN) {
        // SuperAdmin can see all sessions
        whereClause = {};
      } else if (userRole === UserRole.ADMIN) {
        // Admin can only see sessions from companies they created
        const companiesCreatedByAdmin = await prisma.user.findMany({
          where: {
            role: UserRole.COMPANY,
            createdById: userId,
          },
          select: {
            id: true,
            companyId: true,
          }
        });
        
        const companyIds = companiesCreatedByAdmin
          .filter((company: { companyId?: string }) => company.companyId)
          .map((company: { companyId?: string }) => company.companyId as string);
          
        const companyUserIds = companiesCreatedByAdmin.map((company: { id: string }) => company.id);
        
        if (companyIds.length === 0 && companyUserIds.length === 0) {
          // No companies found, return empty results instead of attempting a query
          return NextResponse.json({
            sessions: [],
            pagination: {
              total: 0,
              page,
              limit,
              pages: 0
            }
          });
        }
        
        whereClause = {
          companyId: {
            in: [...new Set([...companyIds, ...companyUserIds])].filter(Boolean)
          }
        };
      } else if (userRole === UserRole.COMPANY) {
        // Company can only see their own sessions
        whereClause = {
          OR: [
            { companyId: userId },
            { createdById: userId }
          ]
        };
      } else if (userRole === UserRole.EMPLOYEE) {
        const employee = await prisma.user.findUnique({
          where: { id: userId },
          select: { companyId: true, subrole: true }
        });
        
        // Check if we can find the employee and their company
        if (!employee || !employee.companyId) {
          console.error("Employee has no company association:", userId);
          return NextResponse.json({
            sessions: [],
            pagination: {
              total: 0,
              page,
              limit,
              pages: 0
            }
          });
        }
        
        // Employee can only see sessions from their company or they created/verified
        whereClause = {
          OR: [
            { companyId: employee.companyId },
            { createdById: userId }
          ]
        };
        
        // Specific case for guards: add needsVerification filter
        if (employee.subrole === EmployeeSubrole.GUARD) {
          const needsVerification = searchParams.get('needsVerification') === 'true';
          if (needsVerification) {
            whereClause = {
              ...whereClause,
              status: "IN_PROGRESS",
              companyId: employee.companyId,
              seal: {
                verified: false
              }
            };
          }
        }
      }
    } catch (error) {
      console.error("Error building where clause:", error);
      return NextResponse.json({
        sessions: [],
        pagination: {
          total: 0,
          page,
          limit,
          pages: 0
        }
      });
    }
    
    // Add status filter if provided
    if (status) {
      whereClause = {
        ...whereClause,
        status
      };
    }
    
    // Add search filter if provided
    if (search) {
      whereClause = {
        ...whereClause,
        OR: [
          { source: { contains: search, mode: 'insensitive' } },
          { destination: { contains: search, mode: 'insensitive' } },
          { 'seal.barcode': { contains: search, mode: 'insensitive' } }
        ]
      };
    }
    
    // Get total count for pagination
    const total = await prisma.session.count({
      where: whereClause
    }).catch((error: Error) => {
      console.error("Error counting sessions:", error);
      return 0;
    });
    
    // If no results, return empty array immediately
    if (total === 0) {
      return NextResponse.json({
        sessions: [],
        pagination: {
          total: 0,
          page: 1,
          limit,
          pages: 0
        }
      });
    }
    
    // Get sessions with pagination
    const sessions = await prisma.session.findMany({
      where: whereClause,
      include: {
        seal: {
          select: {
            id: true,
            barcode: true,
            verified: true,
            scannedAt: true
          }
        },
        company: {
          select: {
            id: true,
            name: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            subrole: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit
    }).catch((error: Error) => {
      console.error("Error fetching sessions:", error);
      return [];
    });
    
    if (sessions.length === 0) {
      return NextResponse.json({
        sessions: [],
        pagination: {
          total: 0,
          page: 1,
          limit,
          pages: 0
        }
      });
    }
    
    // Get activity logs for trip details
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        targetResourceId: {
          in: sessions.map((s: { id: string }) => s.id)
        },
        targetResourceType: 'session',
        action: 'CREATE'
      }
    }).catch((error: Error) => {
      console.error("Error fetching activity logs:", error);
      return [];
    });
    
    // Enhance sessions with trip details
    const enhancedSessions = sessions.map((session: any) => {
      const activityLog = activityLogs.find((log: { targetResourceId: string }) => log.targetResourceId === session.id);
      const details = activityLog?.details as ActivityLogDetails | undefined;
      
      return {
        ...session,
        tripDetails: details?.tripDetails || {},
        qrCodes: details?.qrCodes || {}
      };
    });
    
    return NextResponse.json({
      sessions: enhancedSessions,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching sessions:", error);
    return NextResponse.json({
      error: "Failed to fetch sessions",
      sessions: [],
      pagination: {
        total: 0,
        page: 1,
        limit: 10,
        pages: 0
      }
    }, { status: 200 });  // Return 200 with empty data instead of 500
  }
}

// All authenticated users can access sessions list
// (Role-based filtering is done within the handler)
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
  UserRole.EMPLOYEE
]);

// Add POST handler for session creation
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const session = await getServerSession(authOptions);
      const userId = session?.user.id;
      const userRole = session?.user.role;
      const userSubrole = session?.user.subrole;

      // Only OPERATORS can create sessions
      if (userRole !== UserRole.EMPLOYEE || userSubrole !== EmployeeSubrole.OPERATOR) {
        return NextResponse.json(
          { error: "Unauthorized. Only operators can create sessions" },
          { status: 403 }
        );
      }

      // Check if the operator has permission to create sessions
      const permissions = await prisma.operatorPermissions.findUnique({
        where: { userId: userId }
      });

      if (!permissions?.canCreate) {
        return NextResponse.json(
          { error: "You don't have permission to create sessions. Please contact your administrator." },
          { status: 403 }
        );
      }

      // Extract basic session data
      const formData = await req.formData();
      
      // Extract only the fields that exist in the Session model
      const sessionData = {
        source: formData.get('loadingSite') as string, 
        destination: formData.get('receiverPartyName') as string,
        createdById: userId as string,
      };

      // Get timestamps data
      const loadingDetailsTimestamps = formData.get('loadingDetailsTimestamps');
      const imagesFormTimestamps = formData.get('imagesFormTimestamps');

      // Extract all form data for storing in activity log
      const tripDetails = {
        transporterName: formData.get('transporterName') as string,
        materialName: formData.get('materialName') as string,
        receiverPartyName: formData.get('receiverPartyName') as string,
        vehicleNumber: formData.get('vehicleNumber') as string,
        gpsImeiNumber: formData.get('gpsImeiNumber') as string,
        driverName: formData.get('driverName') as string,
        driverContactNumber: formData.get('driverContactNumber') as string,
        loaderName: formData.get('loaderName') as string,
        challanRoyaltyNumber: formData.get('challanRoyaltyNumber') as string,
        doNumber: formData.get('doNumber') as string,
        freight: parseFloat(formData.get('freight') as string) || 0,
        qualityOfMaterials: formData.get('qualityOfMaterials') as string,
        tpNumber: formData.get('tpNumber') as string,
        grossWeight: parseFloat(formData.get('grossWeight') as string) || 0,
        tareWeight: parseFloat(formData.get('tareWeight') as string) || 0,
        netMaterialWeight: parseFloat(formData.get('netMaterialWeight') as string) || 0,
        loaderMobileNumber: formData.get('loaderMobileNumber') as string,
      };

      // Handle scanned codes
      const scannedCodesJson = formData.get('scannedCodes') as string;
      const scannedCodes = scannedCodesJson ? JSON.parse(scannedCodesJson) : [];

      // Extract files information
      const gpsImeiPicture = formData.get('gpsImeiPicture') as File;
      const vehicleNumberPlatePicture = formData.get('vehicleNumberPlatePicture') as File;
      const driverPicture = formData.get('driverPicture') as File;
      
      // Get employee data to determine company association
      const employee = await prisma.user.findUnique({
        where: { id: userId },
        include: { company: true }
      });
      
      if (!employee || !employee.companyId) {
        return NextResponse.json(
          { error: "Employee is not associated with any company" },
          { status: 400 }
        );
      }
      
      // Check if operator has enough coins (minimum 1 coin needed)
      const operatorCoins = employee.coins ?? 0;
      if (operatorCoins < 1) {
        return NextResponse.json(
          { error: "Insufficient coins. You need at least 1 coin to create a session." },
          { status: 400 }
        );
      }

      // Process images to base64
      let imageBase64Data: Record<string, any> = {};
      
      // Process single images
      if (gpsImeiPicture) {
        imageBase64Data.gpsImeiPicture = {
          contentType: gpsImeiPicture.type,
          data: await fileToBase64(gpsImeiPicture)
        };
      }
      
      if (vehicleNumberPlatePicture) {
        imageBase64Data.vehicleNumberPlatePicture = {
          contentType: vehicleNumberPlatePicture.type,
          data: await fileToBase64(vehicleNumberPlatePicture)
        };
      }
      
      if (driverPicture) {
        imageBase64Data.driverPicture = {
          contentType: driverPicture.type,
          data: await fileToBase64(driverPicture)
        };
      }
      
      // Process array images
      imageBase64Data.sealingImages = [];
      imageBase64Data.vehicleImages = [];
      imageBase64Data.additionalImages = [];
      
      // Helper function to extract and convert files from FormData
      const processFormDataFiles = async (prefix: string, targetArray: any[]) => {
        let index = 0;
        while (formData.get(`${prefix}[${index}]`)) {
          const file = formData.get(`${prefix}[${index}]`) as File;
          targetArray.push({
            contentType: file.type,
            data: await fileToBase64(file)
          });
          index++;
        }
      };
      
      // Process each type of array images
      await processFormDataFiles('sealingImages', imageBase64Data.sealingImages);
      await processFormDataFiles('vehicleImages', imageBase64Data.vehicleImages);
      await processFormDataFiles('additionalImages', imageBase64Data.additionalImages);
      
      // Create session with a seal in a transaction
      const result = await prisma.$transaction(async (tx: any) => {
        // Deduct coin from operator
        const updatedOperator = await tx.user.update({
          where: { id: userId },
          data: { coins: { decrement: 1 } }
        });
      
        // First create the session with only the fields in the schema
        const newSession = await tx.session.create({
          data: {
            ...sessionData,
            companyId: employee.companyId || "", // Ensure companyId is not null
            status: "IN_PROGRESS", // Set to IN_PROGRESS directly since we're creating a seal
          },
        });
        
        // Then create the seal associated with the session
        const seal = await tx.seal.create({
          data: {
            barcode: scannedCodes.length > 0 ? scannedCodes[0] : `SEAL-${Date.now()}`,
            sessionId: newSession.id, // Link the seal to the session
          },
        });

        // Create coin transaction record - coin is spent, not transferred
        await tx.coinTransaction.create({
          data: {
            fromUserId: userId as string,
            toUserId: userId as string, // Operator spends the coin (not transferred to another user)
            amount: 1,
            reason: "SESSION_CREATION",
            reasonText: `Session ID: ${newSession.id} - Session creation cost`
          }
        });

        // Store all the trip details in the activity log
        await tx.activityLog.create({
          data: {
            userId: userId as string,
            action: "CREATE",
            targetResourceId: newSession.id,
            targetResourceType: "session",
            details: {
              tripDetails: {
                ...tripDetails,
              },
              images: {
                gpsImeiPicture: gpsImeiPicture ? `/api/images/${newSession.id}/gpsImei` : null,
                vehicleNumberPlatePicture: vehicleNumberPlatePicture ? `/api/images/${newSession.id}/vehicleNumber` : null,
                driverPicture: driverPicture ? `/api/images/${newSession.id}/driver` : null,
                sealingImages: Array.from({ length: getFileCountFromFormData(formData, 'sealingImages') }, 
                  (_, i) => `/api/images/${newSession.id}/sealing/${i}`),
                vehicleImages: Array.from({ length: getFileCountFromFormData(formData, 'vehicleImages') }, 
                  (_, i) => `/api/images/${newSession.id}/vehicle/${i}`),
                additionalImages: Array.from({ length: getFileCountFromFormData(formData, 'additionalImages') }, 
                  (_, i) => `/api/images/${newSession.id}/additional/${i}`),
              },
              timestamps: {
                loadingDetails: loadingDetailsTimestamps ? JSON.parse(loadingDetailsTimestamps as string) : {},
                imagesForm: imagesFormTimestamps ? JSON.parse(imagesFormTimestamps as string) : {},
              },
              qrCodes: {
                primaryBarcode: scannedCodes.length > 0 ? scannedCodes[0] : `SEAL-${Date.now()}`,
                additionalBarcodes: scannedCodes.length > 1 ? scannedCodes.slice(1) : []
              }
            }
          }
        });

        // Store base64 image data in a separate activity log entry
        await tx.activityLog.create({
          data: {
            userId: userId as string,
            action: "STORE_IMAGES",
            targetResourceId: newSession.id,
            targetResourceType: "session",
            details: {
              imageBase64Data
            }
          }
        });
        
        return { session: newSession, seal };
      });
      
      // Skip file storage since we're using base64
      
      return NextResponse.json({
        success: true,
        sessionId: result.session.id,
        message: "Session created successfully",
      });
    } catch (error) {
      console.error("Error creating session:", error);
      return NextResponse.json(
        { error: "Failed to create session" },
        { status: 500 }
      );
    }
  },
  [UserRole.EMPLOYEE]
);

// Helper function to count files with a specific prefix
function getFileCountFromFormData(formData: FormData, prefix: string): number {
  let count = 0;
  for (const key of formData.keys()) {
    if (key.startsWith(prefix)) {
      count++;
    }
  }
  return count;
} 
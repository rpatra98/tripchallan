import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { ActivityAction, EmployeeSubrole } from "@/prisma/enums";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log("[API DEBUG] Fetching seals for session:", params.id);
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      console.log("[API ERROR] Unauthorized user tried to access seals");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = params.id;

    if (!sessionId) {
      console.log("[API ERROR] Missing session ID");
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    console.log("[API DEBUG] Looking for session with ID:", sessionId);
    
    try {
      // First, get the session to verify it exists
      const sessionData = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          seal: {
            include: {
              verifiedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                  subrole: true,
                },
              },
            },
          },
        },
      });

      if (!sessionData) {
        console.log("[API ERROR] Session not found:", sessionId);
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      console.log("[API DEBUG] Session found, retrieving activity logs");

      // Get all activity logs for this session
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          targetResourceId: sessionId,
          targetResourceType: 'session',
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
              subrole: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      console.log(`[API DEBUG] Found ${activityLogs.length} activity logs for session`);

      // Extract seal information from activity logs
      const sealTags = [];
      
      // Look for CREATE logs that might have seal tag information
      const createLogs = activityLogs.filter(log => log.action === ActivityAction.CREATE);
      
      for (const log of createLogs) {
        try {
          const details = log.details as any;
          let sealTagIds = [];
          
          // Check different possible locations for seal tag IDs
          if (details?.sealTagIds) {
            try {
              sealTagIds = typeof details.sealTagIds === 'string' 
                ? JSON.parse(details.sealTagIds)
                : details.sealTagIds;
            } catch (e) {
              console.log("[API DEBUG] Error parsing sealTagIds:", e);
            }
          } else if (details?.tripDetails?.sealTagIds) {
            sealTagIds = details.tripDetails.sealTagIds;
          } else if (details?.imageBase64Data?.sealTagImages) {
            sealTagIds = Object.keys(details.imageBase64Data.sealTagImages);
          }
          
          if (sealTagIds && sealTagIds.length > 0) {
            console.log(`[API DEBUG] Found ${sealTagIds.length} seal tags in log ${log.id}`);
            
            // Get method information if available
            const methods = {};
            if (details?.sealTagMethods) {
              try {
                Object.assign(methods, typeof details.sealTagMethods === 'string'
                  ? JSON.parse(details.sealTagMethods)
                  : details.sealTagMethods);
              } catch (e) {
                console.log("[API DEBUG] Error parsing sealTagMethods:", e);
              }
            } else if (details?.tripDetails?.sealTagMethods) {
              Object.assign(methods, details.tripDetails.sealTagMethods);
            }
            
            // Add each seal tag to the results
            for (const tagId of sealTagIds) {
              sealTags.push({
                id: `tag-${tagId}`,
                type: 'tag',
                barcode: tagId,
                method: methods[tagId] || 'manual',
                createdAt: log.createdAt,
                createdBy: log.user,
                verified: false, // Tags aren't verified themselves
                verifiedBy: null,
                scannedAt: null,
                source: 'operator',
              });
            }
          }
        } catch (err) {
          console.log(`[API DEBUG] Error processing log ${log.id}:`, err);
        }
      }
      
      // Look for UPDATE logs that might have verification information
      const verificationLogs = activityLogs.filter(log => 
        log.action === ActivityAction.UPDATE && 
        (log.details as any)?.verification
      );
      
      // Process system seals (from database)
      const systemSeals = [];
      
      if (sessionData.seal) {
        systemSeals.push({
          ...sessionData.seal,
          type: 'system',
          source: sessionData.seal.verified ? 'guard' : 'system',
          verificationDetails: null
        });
      }
      
      // Look for verification details in logs
      for (const log of verificationLogs) {
        try {
          const verification = (log.details as any)?.verification;
          if (verification) {
            // Find if there's a matching system seal
            const matchingSystemSeal = systemSeals.find(s => s.id === verification.sealId);
            
            if (matchingSystemSeal) {
              // Update the existing system seal with verification details
              matchingSystemSeal.verificationDetails = verification;
            } else {
              // Create a "virtual" verification seal if no matching system seal
              systemSeals.push({
                id: verification.sealId || `verification-${log.id}`,
                type: 'verification',
                barcode: verification.sealBarcode || `VERIFIED-${Date.now()}`,
                createdAt: log.createdAt,
                createdBy: log.user,
                verified: true,
                verifiedBy: log.user,
                scannedAt: log.createdAt,
                source: 'guard',
                verificationDetails: verification,
              });
            }
          }
        } catch (err) {
          console.log(`[API DEBUG] Error processing verification log ${log.id}:`, err);
        }
      }
      
      // Find image data for seal tags
      // Look for image data in activity logs
      const imageLog = activityLogs.find(log => {
        const details = log.details as any;
        return details?.imageBase64Data || details?.images;
      });
      
      if (imageLog) {
        console.log("[API DEBUG] Found image data in activity log:", imageLog.id);
        const details = imageLog.details as any;
        
        // Try to find sealTagImages or similar structure
        const imageData = details?.imageBase64Data?.sealTagImages || {};
        
        // Update sealTags with image data if available
        for (const sealTag of sealTags) {
          if (imageData[sealTag.barcode]) {
            // If we have the actual base64 data
            if (imageData[sealTag.barcode].data) {
              const contentType = imageData[sealTag.barcode].contentType || 'image/jpeg';
              sealTag.imageData = `data:${contentType};base64,${imageData[sealTag.barcode].data}`;
            }
          }
        }
      }
      
      // Combine all seals
      const allSeals = [...systemSeals, ...sealTags];
      
      console.log(`[API DEBUG] Returning ${allSeals.length} seals (${systemSeals.length} system, ${sealTags.length} tags)`);
      return NextResponse.json(allSeals);
    } catch (prismaError) {
      console.error("[API ERROR] Database error:", prismaError);
      return NextResponse.json(
        { error: "Database error while fetching seals", details: String(prismaError) },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[API ERROR] Unhandled error:", error);
    return NextResponse.json(
      { error: "Failed to fetch seals", details: String(error) },
      { status: 500 }
    );
  }
} 
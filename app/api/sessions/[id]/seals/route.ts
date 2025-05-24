import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import prisma from "@/lib/prisma";
import { Seal, User, ActivityLog } from "@prisma/client";

interface EnrichedSeal extends Seal {
  verificationDetails: any | null;
  verifier: Partial<User> | null;
  verifiedBy: Partial<User> | null;
}

interface ActivityLogWithUser extends ActivityLog {
  user: Partial<User>;
}

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

    console.log("[API DEBUG] Looking for seals with sessionId:", sessionId);
    
    try {
      // Find all seals related to the session
      const seals = await prisma.seal.findMany({
        where: { 
          sessionId: sessionId
        },
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
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      console.log(`[API DEBUG] Found ${seals.length} seals for session ${sessionId}`);

      // Also get associated activity logs for verification details
      const activityLogs = await prisma.activityLog.findMany({
        where: {
          targetResourceId: sessionId,
          targetResourceType: 'session',
          action: 'UPDATE',
          details: {
            path: ['verification'],
            not: null
          }
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
              subrole: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
      
      console.log(`[API DEBUG] Found ${activityLogs.length} activity logs with verification details`);

      // Combine the data - with safer handling of types and null values
      const enrichedSeals = seals.map((seal) => {
        try {
          // Find the corresponding activity log
          const verificationLog = activityLogs.find((log) => {
            try {
              const details = log.details as any;
              return details?.verification?.sealId === seal.id;
            } catch (err) {
              console.log(`[API DEBUG] Error accessing log details for log ${log.id}:`, err);
              return false;
            }
          });

          return {
            ...seal,
            verificationDetails: verificationLog ? (verificationLog.details as any)?.verification ?? null : null,
            verifier: verificationLog?.user ?? null
          } as EnrichedSeal;
        } catch (err) {
          console.log(`[API DEBUG] Error processing seal ${seal.id}:`, err);
          // Return basic seal data if enrichment fails
          return {
            ...seal,
            verificationDetails: null,
            verifier: null
          } as EnrichedSeal;
        }
      });
      
      console.log(`[API DEBUG] Returning ${enrichedSeals.length} enriched seals`);
      return NextResponse.json(enrichedSeals);
    } catch (prismaError) {
      console.error("[API ERROR] Prisma error:", prismaError);
      return NextResponse.json(
        { error: "Database error while fetching seals", details: prismaError },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[API ERROR] Unhandled error fetching seals:", error);
    return NextResponse.json(
      { error: "Failed to fetch seals", details: String(error) },
      { status: 500 }
    );
  }
} 
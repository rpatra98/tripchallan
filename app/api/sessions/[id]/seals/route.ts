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
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sessionId = params.id;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

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
    }) as ActivityLogWithUser[];

    // Combine the data
    const enrichedSeals: EnrichedSeal[] = seals.map((seal: Seal & { verifiedBy: Partial<User> | null }) => {
      // Find the corresponding activity log
      const verificationLog = activityLogs.find((log: ActivityLogWithUser) => {
        const details = log.details as any;
        return details?.verification?.sealId === seal.id;
      });

      return {
        ...seal,
        verificationDetails: verificationLog ? (verificationLog.details as any)?.verification : null,
        verifier: verificationLog ? verificationLog.user : null
      };
    });

    return NextResponse.json(enrichedSeals);

  } catch (error) {
    console.error("Error fetching seals:", error);
    return NextResponse.json(
      { error: "Failed to fetch seals" },
      { status: 500 }
    );
  }
} 
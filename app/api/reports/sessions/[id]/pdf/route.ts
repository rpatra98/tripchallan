import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import { jsPDF } from 'jspdf';

// Helper function to format dates
const formatDate = (dateString: string | Date) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return 'Invalid date';
  }
};

// Generate PDF report for session
export const GET = withAuth(
  async (req: NextRequest, context?: { params: Record<string, string> }) => {
    try {
      if (!context?.params?.id) {
        return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
      }

      const session = await getServerSession(authOptions);
      const userRole = session?.user.role;
      const userId = session?.user.id;
      const sessionId = context.params.id;

      // Fetch session data
      const sessionData = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
          company: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          seal: {
            include: {
              verifiedBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
          comments: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
            take: 5,
          },
        },
      });

      if (!sessionData) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      // Check authorization
      if (![UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY].includes(userRole as UserRole)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
      }

      if (userRole === UserRole.COMPANY && userId !== sessionData.companyId) {
        return NextResponse.json(
          { error: "Unauthorized - You can only download reports for your own sessions" },
          { status: 403 }
        );
      }

      // Create PDF document
      const doc = new jsPDF();

      // Add title
      doc.text("CBUMS - Session Details", 20, 20);
      doc.text(`Session ID: ${sessionData.id}`, 20, 30);
      doc.text(`Status: ${sessionData.status}`, 20, 40);

      // Session Details
      doc.text("Session Details:", 20, 60);
      doc.text(`Created At: ${formatDate(sessionData.createdAt)}`, 20, 70);
      doc.text(`Source: ${sessionData.source || 'N/A'}`, 20, 80);
      doc.text(`Destination: ${sessionData.destination || 'N/A'}`, 20, 90);
      doc.text(`Company: ${sessionData.company.name || 'N/A'}`, 20, 100);
      doc.text(`Created By: ${sessionData.createdBy.name || 'N/A'}`, 20, 110);
      doc.text(`Role: ${sessionData.createdBy.role || 'N/A'}`, 20, 120);

      // Trip Details
      if (sessionData.tripDetails) {
        doc.text("Trip Details:", 20, 140);
        let yPos = 150;
        Object.entries(sessionData.tripDetails).forEach(([key, value]) => {
          const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          doc.text(`${label}: ${value || 'N/A'}`, 20, yPos);
          yPos += 10;
        });
      }

      // Seal Information
      if (sessionData.seal) {
        doc.text("Seal Information:", 20, 200);
        doc.text(`Barcode: ${sessionData.seal.barcode || 'N/A'}`, 20, 210);
        doc.text(`Status: ${sessionData.seal.verified ? 'Verified' : 'Not Verified'}`, 20, 220);
        if (sessionData.seal.verified && sessionData.seal.verifiedBy) {
          doc.text(`Verified By: ${sessionData.seal.verifiedBy.name || 'N/A'}`, 20, 230);
          if (sessionData.seal.scannedAt) {
            doc.text(`Verified At: ${formatDate(sessionData.seal.scannedAt)}`, 20, 240);
          }
        }
      }

      // Comments
      if (sessionData.comments?.length) {
        doc.text("Comments:", 20, 260);
        let yPos = 270;
        sessionData.comments.forEach((comment: { user?: { name?: string }, createdAt: Date, message?: string }) => {
          doc.text(`${comment.user?.name || 'Unknown'} (${formatDate(comment.createdAt)}):`, 20, yPos);
          doc.text(comment.message || '(No text)', 30, yPos + 5);
          yPos += 15;
        });
      }

      // Generate PDF buffer
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

      // Create response
      const response = new NextResponse(pdfBuffer);
      response.headers.set('Content-Type', 'application/pdf');
      response.headers.set('Content-Disposition', `attachment; filename="session-${sessionId}.pdf"`);
      response.headers.set('Content-Length', pdfBuffer.length.toString());
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');

      return response;

    } catch (error: unknown) {
      console.error("Error generating PDF report:", error);
      return NextResponse.json(
        { error: "Failed to generate PDF report", details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY]
); 
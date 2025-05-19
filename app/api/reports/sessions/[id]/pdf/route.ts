import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TripDetails {
  transporterName?: string;
  materialName?: string;
  vehicleNumber?: string;
  gpsImeiNumber?: string;
  driverName?: string;
  driverContactNumber?: string;
  loaderName?: string;
  loaderMobileNumber?: string;
  challanRoyaltyNumber?: string;
  doNumber?: string;
  tpNumber?: string;
  qualityOfMaterials?: string;
  freight?: number;
  grossWeight?: number;
  tareWeight?: number;
  netMaterialWeight?: number;
  loadingSite?: string;
  receiverPartyName?: string;
  [key: string]: unknown;
}

// Helper function to format dates
const formatDate = (dateString: string | Date) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleString();
  } catch {
    return 'Invalid date';
  }
};

// Helper function to safely handle text
const safeText = (text: string | number | boolean | null | undefined): string => {
  if (text === null || text === undefined) return 'N/A';
  return String(text).replace(/[^\x20-\x7E]/g, ''); // Only keep printable ASCII
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

      // Fetch session data with all necessary relations
      const sessionData = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              subrole: true,
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
                  subrole: true,
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
            take: 10,
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
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        putOnlyUsedFonts: true,
        compress: true
      });

      // Initialize document properties
      doc.setProperties({
        title: 'CBUMS Session Report',
        subject: 'Session Details',
        author: 'CBUMS System',
        creator: 'CBUMS'
      });

      // Set default font and size
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);

      // Add autotable plugin
      (doc as any).autoTable = autoTable;

      // Constants for layout
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      let yPos = 10;

      // Add header
      doc.setFillColor(25, 118, 210);
      doc.rect(0, 0, pageWidth, 20, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text("CBUMS - Session Details", pageWidth / 2, 12, { align: 'center' });

      // Add session ID
      doc.setFillColor(245, 245, 245);
      doc.rect(0, 20, pageWidth, 16, 'F');
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(11);
      doc.text(`Session ID: ${sessionData.id}`, margin, 30);

      // Add status badge
      const statusColors = {
        COMPLETED: [46, 204, 113],
        IN_PROGRESS: [52, 152, 219],
        PENDING: [243, 156, 18],
        REJECTED: [231, 76, 60]
      };

      const statusColor = statusColors[sessionData.status as keyof typeof statusColors] || [149, 165, 166];
      const statusText = sessionData.status.replace(/_/g, ' ');

      doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
      doc.roundedRect(pageWidth - 80, 23, 70, 10, 3, 3, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(9);
      doc.text(statusText, pageWidth - 45, 29, { align: 'center' });

      yPos = 46;

      // Function to add section header
      const addSectionHeader = (title: string) => {
        doc.setFillColor(237, 243, 248);
        doc.rect(0, yPos, pageWidth, 16, 'F');
        doc.setTextColor(44, 62, 80);
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(title, margin, yPos + 11);
        yPos += 22;
      };

      // Function to add table
      const addTable = (data: any[][], columnStyles?: any) => {
        (doc as any).autoTable({
          startY: yPos,
          head: [],
          body: data,
          theme: 'grid',
          styles: {
            fontSize: 10,
            cellPadding: 5,
          },
          columnStyles: columnStyles || {
            0: { cellWidth: 120, fillColor: [249, 249, 249] },
            1: { cellWidth: 'auto', fillColor: [255, 255, 255] },
          },
          margin: { left: margin, right: margin },
        });
        yPos = (doc as any).lastAutoTable.finalY + 10;
      };

      // Session Details Section
      addSectionHeader("Session Details");
      addTable([
        [{ content: 'Created At', styles: { fontStyle: 'bold' } }, formatDate(sessionData.createdAt)],
        [{ content: 'Source', styles: { fontStyle: 'bold' } }, sessionData.source || 'N/A'],
        [{ content: 'Destination', styles: { fontStyle: 'bold' } }, sessionData.destination || 'N/A'],
        [{ content: 'Company', styles: { fontStyle: 'bold' } }, sessionData.company.name || 'N/A'],
        [{ content: 'Created By', styles: { fontStyle: 'bold' } }, sessionData.createdBy.name || 'N/A'],
        [{ content: 'Role', styles: { fontStyle: 'bold' } }, sessionData.createdBy.role || 'N/A']
      ]);

      // Images Section
      if (sessionData.images && Object.keys(sessionData.images).length > 0) {
        addSectionHeader("Images");
        const imageData = [];
        
        if (sessionData.images.driverPicture) {
          imageData.push(['Driver Picture', 'Available']);
        }
        if (sessionData.images.vehicleNumberPlatePicture) {
          imageData.push(['Vehicle Number Plate Picture', 'Available']);
        }
        if (sessionData.images.gpsImeiPicture) {
          imageData.push(['GPS/IMEI Picture', 'Available']);
        }
        if (sessionData.images.sealingImages?.length) {
          imageData.push(['Sealing Images', `${sessionData.images.sealingImages.length} available`]);
        }
        if (sessionData.images.vehicleImages?.length) {
          imageData.push(['Vehicle Images', `${sessionData.images.vehicleImages.length} available`]);
        }
        if (sessionData.images.additionalImages?.length) {
          imageData.push(['Additional Images', `${sessionData.images.additionalImages.length} available`]);
        }

        if (imageData.length > 0) {
          addTable(imageData.map(row => [
            { content: row[0], styles: { fontStyle: 'bold' } },
            row[1]
          ]));
        } else {
          doc.setFontSize(10);
          doc.setFont('helvetica', 'normal');
          doc.text("No images available", margin, yPos);
          yPos += 20;
        }
      }

      // Trip Details Section
      addSectionHeader("Trip Details");
      const tripDetails = sessionData.tripDetails as TripDetails || {};
      const tripData = Object.entries(tripDetails).map(([key, value]) => [
        { content: key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()), styles: { fontStyle: 'bold' } },
        safeText(value as string | number | boolean | null | undefined)
      ]);
      addTable(tripData);

      // Seal Information Section
      if (sessionData.seal) {
        addSectionHeader("Seal Information");
        const sealData = [
          [{ content: 'Barcode', styles: { fontStyle: 'bold' } }, sessionData.seal.barcode || 'N/A'],
          [{ content: 'Status', styles: { fontStyle: 'bold' } }, sessionData.seal.verified ? 'Verified' : 'Not Verified']
        ];

        if (sessionData.seal.verified && sessionData.seal.verifiedBy) {
          sealData.push([
            { content: 'Verified By', styles: { fontStyle: 'bold' } },
            sessionData.seal.verifiedBy.name || 'N/A'
          ]);
          if (sessionData.seal.scannedAt) {
            sealData.push([
              { content: 'Verified At', styles: { fontStyle: 'bold' } },
              formatDate(sessionData.seal.scannedAt)
            ]);
          }
        }
        addTable(sealData);
      }

      // Comments Section
      if (sessionData.comments?.length) {
        addSectionHeader("Comments");
        const commentData = sessionData.comments.slice(0, 5).map((comment: { user?: { name?: string }, createdAt: Date, message?: string }) => [
          { content: `${comment.user?.name || 'Unknown'} (${formatDate(comment.createdAt)})`, styles: { fontStyle: 'bold' } },
          comment.message || '(No text)'
        ]);
        addTable(commentData);
      }

      // Add footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(
          `Page ${i} of ${pageCount} - Generated on ${new Date().toLocaleString()}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
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
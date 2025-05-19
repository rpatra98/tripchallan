import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type to include autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: {
      finalY: number;
    };
  }
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

      // Fetch activity log for trip details
      const activityLog = await prisma.activityLog.findFirst({
        where: {
          targetResourceId: sessionId,
          targetResourceType: 'session',
          action: 'CREATE',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      console.log('Activity Log:', JSON.stringify(activityLog, null, 2));

      // Extract trip details from activity log
      interface TripDetails {
        freight?: number;
        doNumber?: string;
        tpNumber?: string;
        driverName?: string;
        loaderName?: string;
        tareWeight?: number;
        grossWeight?: number;
        materialName?: string;
        gpsImeiNumber?: string;
        vehicleNumber?: string;
        transporterName?: string;
        receiverPartyName?: string;
        loaderMobileNumber?: string;
        qualityOfMaterials?: string;
        driverContactNumber?: string;
        challanRoyaltyNumber?: string;
      }

      let tripDetails: TripDetails = {};
      
      if (activityLog?.details) {
      let detailsData: any;
      if (typeof activityLog.details === 'string') {
        try {
          detailsData = JSON.parse(activityLog.details);
        } catch (e) {
          console.error("Failed to parse activityLog.details", e);
        }
      } else {
        detailsData = activityLog.details;
      }

      if (detailsData?.tripDetails) {
        tripDetails = detailsData.tripDetails;
      }

      console.log('Parsed Trip Details:', JSON.stringify(tripDetails, null, 2));
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
        format: 'a4'
      });

      // Set initial font
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);

      // Add title
      doc.text('Session Details', 20, 20);
      doc.setFontSize(12);
      doc.text(`Session ID: ${sessionData.id}`, 20, 30);
      doc.text(`Status: ${sessionData.status.replace(/_/g, ' ')}`, 20, 40);

      // Basic Information
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Basic Information', 20, 55);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const basicInfo = [
        ['Source', sessionData.source || 'N/A'],
        ['Destination', sessionData.destination || 'N/A'],
        ['Created', formatDate(sessionData.createdAt)],
        ['Company', sessionData.company.name || 'N/A'],
      ];

      autoTable(doc, {
        startY: 60,
        head: [],
        body: basicInfo,
        theme: 'grid',
        styles: { fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold' },
          1: { cellWidth: 130 }
        }
      });

      // Trip Details
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Trip Details', 20, (doc as any).lastAutoTable.finalY + 10);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const tripDetailsRows = [
        ['Freight', tripDetails.freight?.toString() || 'N/A'],
        ['Do Number', tripDetails.doNumber?.toString() || 'N/A'],
        ['Tp Number', tripDetails.tpNumber?.toString() || 'N/A'],
        ['Driver Name', tripDetails.driverName?.toString() || 'N/A'],
        ['Loader Name', tripDetails.loaderName?.toString() || 'N/A'],
        ['Tare Weight', tripDetails.tareWeight?.toString() || 'N/A'],
        ['Gross Weight', tripDetails.grossWeight?.toString() || 'N/A'],
        ['Material Name', tripDetails.materialName?.toString() || 'N/A'],
        ['Gps Imei Number', tripDetails.gpsImeiNumber?.toString() || 'N/A'],
        ['Vehicle Number', tripDetails.vehicleNumber?.toString() || 'N/A'],
        ['Transporter Name', tripDetails.transporterName?.toString() || 'N/A'],
        ['Receiver Party Name', tripDetails.receiverPartyName?.toString() || 'N/A'],
        ['Loader Mobile Number', tripDetails.loaderMobileNumber?.toString() || 'N/A'],
        ['Quality Of Materials', tripDetails.qualityOfMaterials?.toString() || 'N/A'],
        ['Driver Contact Number', tripDetails.driverContactNumber?.toString() || 'N/A'],
        ['Challan Royalty Number', tripDetails.challanRoyaltyNumber?.toString() || 'N/A'],
      ];

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 15,
        head: [],
        body: tripDetailsRows,
        theme: 'grid',
        styles: { fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 60, fontStyle: 'bold' },
          1: { cellWidth: 110 }
        }
      });

      // Seal Information
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Seal Information', 20, (doc as any).lastAutoTable.finalY + 10);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const sealInfo = [
        ['Barcode', sessionData.seal?.barcode || 'N/A'],
        ['Status', sessionData.seal?.verified ? 'Verified' : 'Unverified'],
      ];

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 15,
        head: [],
        body: sealInfo,
        theme: 'grid',
        styles: { fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold' },
          1: { cellWidth: 130 }
        }
      });

      // Add footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.text(
          `Page ${i} of ${pageCount} | Generated on ${new Date().toLocaleString()}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
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
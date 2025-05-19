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
      doc.text('Basic Information', 20, 55);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const basicInfo = [
        ['Created At', formatDate(sessionData.createdAt)],
        ['Source', sessionData.source || 'N/A'],
        ['Destination', sessionData.destination || 'N/A'],
        ['Status', sessionData.status.replace(/_/g, ' ')],
        ['Session ID', sessionData.id],
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

      // Company Information
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Company Information', 20, (doc as any).lastAutoTable.finalY + 10);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      const companyInfo = [
        ['Company Name', sessionData.company.name || 'N/A'],
        ['Company Email', sessionData.company.email || 'N/A'],
        ['Created By', sessionData.createdBy.name || 'N/A'],
        ['Creator Email', sessionData.createdBy.email || 'N/A'],
        ['Role', sessionData.createdBy.role || 'N/A'],
      ];

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 15,
        head: [],
        body: companyInfo,
        theme: 'grid',
        styles: { fontSize: 10 },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: 'bold' },
          1: { cellWidth: 130 }
        }
      });

      // Trip Details
      if (sessionData.tripDetails) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Trip Details', 20, (doc as any).lastAutoTable.finalY + 10);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const tripDetails = Object.entries(sessionData.tripDetails).map(([key, value]) => {
          // Format the key for better readability
          const formattedKey = key
            .replace(/([A-Z])/g, ' $1') // Add space before capital letters
            .replace(/^./, str => str.toUpperCase()) // Capitalize first letter
            .replace(/_/g, ' ') // Replace underscores with spaces
            .trim();

          // Format the value based on its type
          let formattedValue: string;
          if (value === null || value === undefined) {
            formattedValue = 'N/A';
          } else if (typeof value === 'boolean') {
            formattedValue = value ? 'Yes' : 'No';
          } else if (typeof value === 'object') {
            formattedValue = JSON.stringify(value);
          } else {
            formattedValue = String(value);
          }

          return [formattedKey, formattedValue] as [string, string];
        });

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 15,
          head: [],
          body: tripDetails,
          theme: 'grid',
          styles: { fontSize: 10 },
          columnStyles: {
            0: { cellWidth: 40, fontStyle: 'bold' },
            1: { cellWidth: 130 }
          }
        });
      }

      // Seal Information
      if (sessionData.seal) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Seal Information', 20, (doc as any).lastAutoTable.finalY + 10);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const sealInfo = [
          ['Barcode', sessionData.seal.barcode || 'N/A'],
          ['Status', sessionData.seal.verified ? 'Verified' : 'Not Verified'],
          ['Created At', formatDate(sessionData.seal.createdAt)],
          ['Updated At', formatDate(sessionData.seal.updatedAt)],
        ];

        if (sessionData.seal.verified && sessionData.seal.verifiedBy) {
          sealInfo.push(
            ['Verified By', sessionData.seal.verifiedBy.name || 'N/A'],
            ['Verifier Email', sessionData.seal.verifiedBy.email || 'N/A'],
            ['Verifier Role', sessionData.seal.verifiedBy.role || 'N/A']
          );
          if (sessionData.seal.scannedAt) {
            sealInfo.push(['Verified At', formatDate(sessionData.seal.scannedAt)]);
          }
        }

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
      }

      // Comments
      if (sessionData.comments?.length) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Comments', 20, (doc as any).lastAutoTable.finalY + 10);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');

        const comments = sessionData.comments.map((comment: { user?: { name?: string, role?: string }, createdAt: Date, message?: string }) => [
          `${comment.user?.name || 'Unknown'} (${comment.user?.role || 'Unknown'})`,
          `${formatDate(comment.createdAt)}\n${comment.message || '(No text)'}`
        ]);

        autoTable(doc, {
          startY: (doc as any).lastAutoTable.finalY + 15,
          head: [],
          body: comments,
          theme: 'grid',
          styles: { fontSize: 10 },
          columnStyles: {
            0: { cellWidth: 40, fontStyle: 'bold' },
            1: { cellWidth: 130 }
          }
        });
      }

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
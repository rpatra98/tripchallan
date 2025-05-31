import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/lib/enums";
import { jsPDF } from "jspdf";

// Helper function to format dates safely
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

async function handler(
  req: NextRequest,
  context?: { params: Record<string, string> }
) {
  try {
    if (!context || !context.params.sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }
    
    const sessionId = context.params.sessionId;

    // Get the session with all related data
    const session = await supabase.from('sessions').findUnique({
      where: { id: sessionId },
      include: {
        company: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
            subrole: true,
          },
        },
        seal: {
          include: {
            verifiedBy: {
              select: {
                id: true,
                name: true,
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
          take: 10, // Limit comments to avoid large PDFs
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    try {
      // Create a PDF document using jsPDF
      const doc = new jsPDF();
      
      let yPos = 10;
      const lineHeight = 7;
      const leftMargin = 10;
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Add Title
      doc.setFontSize(16);
      doc.text('Session Report', pageWidth / 2, yPos, { align: 'center' });
      yPos += lineHeight * 2;
      
      // Session details
      doc.setFontSize(14);
      doc.text("Session Details", leftMargin, yPos);
      yPos += lineHeight;
      doc.setFontSize(10);
      
      doc.text(`Session ID: ${safeText(session.id)}`, leftMargin, yPos);
      yPos += lineHeight;
      doc.text(`Created on: ${formatDate(session.createdAt)}`, leftMargin, yPos);
      yPos += lineHeight;
      doc.text(`Status: ${safeText(session.status)}`, leftMargin, yPos);
      yPos += lineHeight;
      doc.text(`Source: ${safeText(session.source)}`, leftMargin, yPos);
      yPos += lineHeight;
      doc.text(`Destination: ${safeText(session.destination)}`, leftMargin, yPos);
      yPos += lineHeight * 2;
      
      // Company details
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 10;
      }
      
      doc.setFontSize(14);
      doc.text("Company Information", leftMargin, yPos);
      yPos += lineHeight;
      doc.setFontSize(10);
      
      doc.text(`Company: ${safeText(session.company.name)}`, leftMargin, yPos);
      yPos += lineHeight;
      doc.text(`Email: ${safeText(session.company.email)}`, leftMargin, yPos);
      yPos += lineHeight;
      
      if (session.company.phone) {
        doc.text(`Phone: ${safeText(session.company.phone)}`, leftMargin, yPos);
        yPos += lineHeight;
      }
      
      if (session.company.address) {
        doc.text(`Address: ${safeText(session.company.address)}`, leftMargin, yPos);
        yPos += lineHeight;
      }
      
      yPos += lineHeight;
      
      // Creator details
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 10;
      }
      
      doc.setFontSize(14);
      doc.text("Created By", leftMargin, yPos);
      yPos += lineHeight;
      doc.setFontSize(10);
      
      doc.text(`Name: ${safeText(session.createdBy.name)}`, leftMargin, yPos);
      yPos += lineHeight;
      doc.text(`Email: ${safeText(session.createdBy.email)}`, leftMargin, yPos);
      yPos += lineHeight;
      doc.text(`Role: ${safeText(session.createdBy.subrole)}`, leftMargin, yPos);
      yPos += lineHeight * 2;
      
      // Seal information
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage();
        yPos = 10;
      }
      
      doc.setFontSize(14);
      doc.text("Seal Information", leftMargin, yPos);
      yPos += lineHeight;
      doc.setFontSize(10);
      
      doc.text(`Barcode: ${safeText(session.seal?.barcode) || 'N/A'}`, leftMargin, yPos);
      yPos += lineHeight;
      doc.text(`Verified: ${session.seal?.verified ? "Yes" : "No"}`, leftMargin, yPos);
      yPos += lineHeight;
      
      if (session.seal?.scannedAt) {
        doc.text(`Scanned at: ${formatDate(session.seal.scannedAt)}`, leftMargin, yPos);
        yPos += lineHeight;
      }
      
      if (session.seal?.verifiedBy) {
        doc.text(`Verified by: ${safeText(session.seal.verifiedBy.name)} (${safeText(session.seal.verifiedBy.subrole)})`, leftMargin, yPos);
        yPos += lineHeight;
      }
      
      yPos += lineHeight;
      
      // Comments
      if (session.comments.length > 0) {
        // Check if we need a new page
        if (yPos > 250) {
          doc.addPage();
          yPos = 10;
        }
        
        doc.setFontSize(14);
        doc.text("Comments", leftMargin, yPos);
        yPos += lineHeight;
        doc.setFontSize(10);
        
        for (let i = 0; i < Math.min(session.comments.length, 5); i++) {
          try {
            const comment = session.comments[i];
            const userName = comment.user?.name || 'Unknown';
            const userRole = comment.user?.role || '';
            const commentDate = formatDate(comment.createdAt);
            
            // Check if we need a new page
            if (yPos > 270) {
              doc.addPage();
              yPos = 10;
            }
            
            doc.text(`${safeText(userName)} (${safeText(userRole)}) on ${commentDate}:`, leftMargin, yPos);
            yPos += lineHeight;
            doc.text(safeText(comment.message), leftMargin + 5, yPos);
            yPos += lineHeight * 1.5;
          } catch (error: unknown) {
            console.error("Error processing comment:", error);
            continue;
          }
        }
      }
      
      // Get the PDF as a buffer
      const pdfOutput = doc.output('arraybuffer');
      const pdfBuffer = Buffer.from(pdfOutput);
      
      // Create response with PDF
      const response = new NextResponse(pdfBuffer);
      
      response.headers.set('Content-Type', 'application/pdf');
      response.headers.set('Content-Disposition', `attachment; filename="session-${sessionId}.pdf"`);
      response.headers.set('Content-Length', pdfBuffer.length.toString());
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.headers.set('Pragma', 'no-cache');
      response.headers.set('Expires', '0');
      
      return response;
    } catch (docError) {
      console.error("Error creating PDF document:", docError);
      return NextResponse.json(
        { error: "Failed to create PDF document", details: docError instanceof Error ? docError.message : String(docError) },
        { status: 500 }
      );
    }
  } catch (error: unknown) {
    console.error("Error generating PDF report:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF report", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

// Users with these roles can access PDF reports
export const GET = withAuth(handler, [
  UserRole.SUPERADMIN,
  UserRole.ADMIN,
  UserRole.COMPANY,
]); 
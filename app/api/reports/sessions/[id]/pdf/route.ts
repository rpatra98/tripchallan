import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import { jsPDF } from 'jspdf';

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
      if (!context || !context.params.id) {
        return NextResponse.json(
          { error: "Session ID is required" },
          { status: 400 }
        );
      }

      const session = await getServerSession(authOptions);
      const userRole = session?.user.role;
      const userId = session?.user.id;
      
      const sessionId = context.params.id;
      
      // Fetch the session with related data
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
            take: 10, // Limit comments to avoid large PDFs
          },
        },
      });

      if (!sessionData) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
      
      // Check authorization - only SUPERADMIN, ADMIN and COMPANY can download reports
      if (
        userRole !== UserRole.SUPERADMIN && 
        userRole !== UserRole.ADMIN && 
        userRole !== UserRole.COMPANY
      ) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 403 }
        );
      }
      
      // If COMPANY user, check if they own the session
      if (userRole === UserRole.COMPANY && userId !== sessionData.companyId) {
        return NextResponse.json(
          { error: "Unauthorized - You can only download reports for your own sessions" },
          { status: 403 }
        );
      }
      
      // Fetch activity log data for the session to get trip details
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
      
      // Extract trip details from activity log
      let tripDetails: TripDetails = {};
      
      if (activityLog?.details) {
        const details = activityLog.details as { tripDetails?: TripDetails };
        
        // Extract trip details
        if (details.tripDetails) {
          tripDetails = details.tripDetails;
        }
      }
      
      try {
        // Fetch more detailed session data directly from the database
        const detailedSessionData = await prisma.session.findUnique({
          where: { id: sessionId },
          include: {
            createdBy: true,
            company: true,
            seal: {
              include: {
                verifiedBy: true,
              },
            },
            comments: {
              include: {
                user: true,
              },
              orderBy: {
                createdAt: "desc",
              },
              take: 10,
            },
            // Include any other relationships needed for complete data
          },
        });

        if (!detailedSessionData) {
          return NextResponse.json(
            { error: "Detailed session data not found" },
            { status: 404 }
          );
        }

        // Get direct session data (for fields that might not be in activityLog)
        const directTripDetails = detailedSessionData.tripDetails || {};
        
        // Merge both sources of trip details
        let completeDetails = { ...directTripDetails };
        if (tripDetails && Object.keys(tripDetails).length > 0) {
          completeDetails = { ...completeDetails, ...tripDetails };
        }
        
        // Get all images
        const images = detailedSessionData.images || {};
        
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
        
        // Session Basic Info
        doc.setFontSize(14);
        doc.text('Session Information', leftMargin, yPos);
        yPos += lineHeight;
        doc.setFontSize(10);
        
        doc.text(`Session ID: ${safeText(sessionData.id)}`, leftMargin, yPos);
        yPos += lineHeight;
        doc.text(`Status: ${safeText(sessionData.status)}`, leftMargin, yPos);
        yPos += lineHeight;
        doc.text(`Created At: ${formatDate(sessionData.createdAt)}`, leftMargin, yPos);
        yPos += lineHeight;
        doc.text(`Source: ${safeText(sessionData.source) || 'N/A'}`, leftMargin, yPos);
        yPos += lineHeight;
        doc.text(`Destination: ${safeText(sessionData.destination) || 'N/A'}`, leftMargin, yPos);
        yPos += lineHeight;
        doc.text(`Company: ${safeText(sessionData.company.name) || 'N/A'}`, leftMargin, yPos);
        yPos += lineHeight;
        doc.text(`Created By: ${safeText(sessionData.createdBy.name) || 'N/A'} (${safeText(sessionData.createdBy.email) || 'N/A'})`, leftMargin, yPos);
        yPos += lineHeight * 2;
        
        // Trip Details
        if (Object.keys(completeDetails).length > 0) {
          // Check if we need a new page
          if (yPos > 250) {
            doc.addPage();
            yPos = 10;
          }
          
          doc.setFontSize(14);
          doc.text('Trip Details', leftMargin, yPos);
          yPos += lineHeight;
          doc.setFontSize(10);
          
          // Define comprehensive list of known fields with proper labels
          const fieldLabels: Record<string, string> = {
            transporterName: "Transporter Name",
            materialName: "Material Name",
            vehicleNumber: "Vehicle Number",
            gpsImeiNumber: "GPS IMEI Number",
            driverName: "Driver Name",
            driverContactNumber: "Driver Contact Number",
            loaderName: "Loader Name",
            loaderMobileNumber: "Loader Mobile Number",
            challanRoyaltyNumber: "Challan/Royalty Number",
            doNumber: "DO Number",
            tpNumber: "TP Number",
            qualityOfMaterials: "Quality of Materials",
            freight: "Freight",
            grossWeight: "Gross Weight (kg)",
            tareWeight: "Tare Weight (kg)",
            netMaterialWeight: "Net Material Weight (kg)",
            loadingSite: "Loading Site",
            receiverPartyName: "Receiver Party Name"
          };
          
          // First add fields from our known list
          for (const [key, label] of Object.entries(fieldLabels)) {
            if (key in completeDetails) {
              try {
                // Check if we need a new page
                if (yPos > 270) {
                  doc.addPage();
                  yPos = 10;
                }
                
                const value = completeDetails[key as keyof typeof completeDetails];
                doc.text(`${label}: ${safeText(value as string | number | boolean | null | undefined)}`, leftMargin, yPos);
                yPos += lineHeight;
              } catch {
                console.error(`Error processing trip detail ${key}`);
                continue;
              }
            }
          }
          
          // Then add any other fields that might exist
          for (const [key, value] of Object.entries(completeDetails)) {
            if (!(key in fieldLabels)) {
              try {
                // Check if we need a new page
                if (yPos > 270) {
                  doc.addPage();
                  yPos = 10;
                }
                
                // Format key from camelCase to Title Case with spaces
                const formattedKey = key.replace(/([A-Z])/g, ' $1')
                  .replace(/^./, str => str.toUpperCase());
                
                doc.text(`${formattedKey}: ${safeText(value as string | number | boolean | null | undefined)}`, leftMargin, yPos);
                yPos += lineHeight;
              } catch {
                console.error(`Error processing trip detail ${key}`);
                continue;
              }
            }
          }
          yPos += lineHeight;
        }
        
        // Image Listings (we can't embed images directly but we can list them)
        if (images && Object.keys(images).length > 0) {
          // Check if we need a new page
          if (yPos > 250) {
            doc.addPage();
            yPos = 10;
          }
          
          doc.setFontSize(14);
          doc.text('Uploaded Images Information', leftMargin, yPos);
          yPos += lineHeight;
          doc.setFontSize(10);
          
          // Image categories and counts
          if (images.driverPicture) {
            doc.text(`Driver Picture: Available`, leftMargin, yPos);
            yPos += lineHeight;
          }
          
          if (images.vehicleNumberPlatePicture) {
            doc.text(`Vehicle Number Plate Picture: Available`, leftMargin, yPos);
            yPos += lineHeight;
          }
          
          if (images.gpsImeiPicture) {
            doc.text(`GPS/IMEI Picture: Available`, leftMargin, yPos);
            yPos += lineHeight;
          }
          
          if (images.sealingImages && images.sealingImages.length > 0) {
            doc.text(`Sealing Images: ${images.sealingImages.length} available`, leftMargin, yPos);
            yPos += lineHeight;
          }
          
          if (images.vehicleImages && images.vehicleImages.length > 0) {
            doc.text(`Vehicle Images: ${images.vehicleImages.length} available`, leftMargin, yPos);
            yPos += lineHeight;
          }
          
          if (images.additionalImages && images.additionalImages.length > 0) {
            doc.text(`Additional Images: ${images.additionalImages.length} available`, leftMargin, yPos);
            yPos += lineHeight;
          }
          
          yPos += lineHeight;
        }
        
        // Seal Information
        if (sessionData.seal) {
          // Check if we need a new page
          if (yPos > 250) {
            doc.addPage();
            yPos = 10;
          }
          
          doc.setFontSize(14);
          doc.text('Seal Information', leftMargin, yPos);
          yPos += lineHeight;
          doc.setFontSize(10);
          
          doc.text(`Barcode: ${safeText(sessionData.seal.barcode) || 'N/A'}`, leftMargin, yPos);
          yPos += lineHeight;
          doc.text(`Status: ${sessionData.seal.verified ? 'Verified' : 'Not Verified'}`, leftMargin, yPos);
          yPos += lineHeight;
          
          if (sessionData.seal.verified && sessionData.seal.verifiedBy) {
            doc.text(`Verified By: ${safeText(sessionData.seal.verifiedBy.name) || 'N/A'}`, leftMargin, yPos);
            yPos += lineHeight;
            
            if (sessionData.seal.scannedAt) {
              doc.text(`Verified At: ${formatDate(sessionData.seal.scannedAt)}`, leftMargin, yPos);
              yPos += lineHeight;
            }
          }
          yPos += lineHeight;
        }
        
        // Comments section if available
        if (sessionData.comments && sessionData.comments.length > 0) {
          // Check if we need a new page
          if (yPos > 250) {
            doc.addPage();
            yPos = 10;
          }
          
          doc.setFontSize(14);
          doc.text('Comments', leftMargin, yPos);
          yPos += lineHeight;
          doc.setFontSize(10);
          
          for (let i = 0; i < Math.min(sessionData.comments.length, 5); i++) {
            try {
              const comment = sessionData.comments[i];
              const userName = comment.user?.name || 'Unknown';
              const commentDate = formatDate(comment.createdAt);
              const commentText = comment.message || '(No text)';
              
              // Check if we need a new page
              if (yPos > 270) {
                doc.addPage();
                yPos = 10;
              }
              
              doc.text(`${userName} on ${commentDate}:`, leftMargin, yPos);
              yPos += lineHeight;
              doc.text(commentText, leftMargin + 5, yPos);
              yPos += lineHeight * 1.5;
            } catch {
              console.error(`Error processing comment ${i}`);
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
      } catch (docError: unknown) {
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
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY]
); 
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

interface VerificationDetails {
  allMatch: boolean;
  fieldVerifications: Record<string, {
    operatorValue: string;
    guardValue: string;
    comment?: string;
  }>;
}

// Helper to format dates
const formatDate = (date: Date | string) => {
  try {
    return new Date(date).toLocaleString();
  } catch {
    return String(date);
  }
};

// Generate a simple PDF report for session
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
      const sessionId = context.params.id;
      
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
      
      // ======== DATA FETCHING SECTION ========
      
      // 1. Fetch the session with related data
      const sessionData = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          createdBy: {
            select: {
              id: true, name: true, email: true, role: true, subrole: true,
            },
          },
          company: {
            select: {
              id: true, name: true, email: true,
            },
          },
          seal: {
            include: {
              verifiedBy: {
                select: {
                  id: true, name: true, email: true, role: true, subrole: true,
                },
              },
            },
          },
          comments: {
            include: {
              user: {
                select: {
                  id: true, name: true, role: true,
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
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
      
      console.log("Session Data Overview:", 
        JSON.stringify(Object.keys(sessionData), null, 2));
      
      // 2. Fetch activity log with trip details (most reliable source)
      const tripActivityLog = await prisma.activityLog.findFirst({
        where: {
          targetResourceId: sessionId,
          targetResourceType: 'session',
          action: 'CREATE',
          details: {
            path: ['tripDetails'],
            not: null,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      
      console.log(`Found trip activity log? ${tripActivityLog ? 'Yes (ID: ' + tripActivityLog.id + ')' : 'No'}`);
      
      // 3. Fetch verification logs
      const verificationLogs = await prisma.activityLog.findMany({
        where: {
          targetResourceId: sessionId,
          targetResourceType: 'session',
          action: 'UPDATE',
        },
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          action: true,
          details: true,
          createdAt: true,
          userId: true,
          user: {
            select: {
              id: true, name: true, role: true, subrole: true
            }
          }
        }
      });
      
      // ======== DATA EXTRACTION SECTION ========
      
      // 1. Extract trip details from activity log (primary source)
      let tripDetails: Record<string, any> = {};
      
      if (tripActivityLog?.details) {
        let details = tripActivityLog.details;
        
        // Parse if it's a string
        if (typeof details === 'string') {
          try {
            details = JSON.parse(details);
          } catch (e) {
            console.error("Failed to parse trip activity log details:", e);
          }
        }
        
        // Extract from common locations
        if (details?.tripDetails && typeof details.tripDetails === 'object') {
          console.log("Found tripDetails directly in activity log");
          tripDetails = details.tripDetails;
        } else if (details?.data?.tripDetails && typeof details.data.tripDetails === 'object') {
          console.log("Found tripDetails in activity log data object");
          tripDetails = details.data.tripDetails;
        }
        
        console.log(`Extracted ${Object.keys(tripDetails).length} trip detail fields from activity log`);
      }
      
      // 2. Extract direct trip details from session data
      const directTripDetails = sessionData.tripDetails || {};
      console.log(`Direct trip details: ${Object.keys(directTripDetails).length} fields`);
      
      // 3. Extract direct fields from session data
      const directFieldNames = [
        'vehicleNumber', 'driverName', 'driverContactNumber', 'freight', 
        'transporterName', 'materialName', 'gpsImeiNumber', 'challanRoyaltyNumber',
        'doNumber', 'tpNumber', 'grossWeight', 'tareWeight', 'loadingSite',
        'receiverPartyName', 'loaderName', 'loaderMobileNumber', 'qualityOfMaterials',
        'netMaterialWeight'
      ];
      
      let directFields: Record<string, any> = {};
      for (const field of directFieldNames) {
        if (sessionData[field as keyof typeof sessionData] !== undefined && 
            sessionData[field as keyof typeof sessionData] !== null) {
          directFields[field] = sessionData[field as keyof typeof sessionData];
        }
      }
      
      console.log(`Direct session fields: ${Object.keys(directFields).length} fields`);
      
      // 4. Emergency fallback - scan all properties for trip-related fields
      let emergencyFields: Record<string, any> = {};
      for (const key of Object.keys(sessionData)) {
        const lowerKey = key.toLowerCase();
        if (
          lowerKey.includes('vehicle') || lowerKey.includes('driver') || 
          lowerKey.includes('transporter') || lowerKey.includes('material') || 
          lowerKey.includes('weight') || lowerKey.includes('freight') ||
          lowerKey.includes('loader') || lowerKey.includes('challan') || 
          lowerKey.includes('gps')
        ) {
          const value = sessionData[key as keyof typeof sessionData];
          if (value !== undefined && value !== null) {
            emergencyFields[key] = value;
          }
        }
      }
      
      console.log(`Emergency fields: ${Object.keys(emergencyFields).length} fields`);
      
      // 5. Combine all sources with priority order
      let allTripFields: Record<string, any> = { ...tripDetails };
      
      // Add fields from other sources only if not already present
      const addIfMissing = (source: Record<string, any>) => {
        for (const [key, value] of Object.entries(source)) {
          if (value !== undefined && value !== null && !allTripFields[key]) {
            allTripFields[key] = value;
          }
        }
      };
      
      addIfMissing(directTripDetails);
      addIfMissing(directFields);
      addIfMissing(emergencyFields);
      
      // Last resort fallback - use basic session info
      if (Object.keys(allTripFields).length === 0) {
        console.log("Using last resort fallback with basic session info");
        allTripFields = {
          sessionId: sessionId,
          source: sessionData.source || 'N/A',
          destination: sessionData.destination || 'N/A',
          status: sessionData.status || 'N/A',
          createdAt: sessionData.createdAt ? formatDate(sessionData.createdAt) : 'N/A'
        };
      }
      
      console.log(`Final combined trip fields: ${Object.keys(allTripFields).length} fields`);
      
      // 6. Extract verification details
      let verificationDetails: VerificationDetails | null = null;
      const verificationLog = verificationLogs.find((log: { details: any }) => 
        log.details && typeof log.details === 'object' && 'verification' in log.details
      );
      
      if (verificationLog?.details) {
        let details = verificationLog.details;
        
        // Parse if it's a string
        if (typeof details === 'string') {
          try {
            details = JSON.parse(details);
          } catch (e) {
            console.error("Failed to parse verification details:", e);
          }
        }
        
        if (details?.verification) {
          verificationDetails = details.verification as VerificationDetails;
        }
      }
      
      // 7. Extract image information
      let imageInfo: Record<string, any> = {};
      
      if (sessionData.images && typeof sessionData.images === 'object') {
        imageInfo = sessionData.images;
      }
      
      // ======== PDF GENERATION SECTION ========
      
      // Create PDF document
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Document settings
      const margin = 20;
      let yPos = 20;
      const lineHeight = 7;

      // Helper functions for PDF generation
      const addSectionHeading = (text: string) => {
        doc.setFont('helvetica', 'bold');
        yPos += lineHeight * 1.5;
        doc.text(text, margin, yPos);
        doc.line(margin, yPos + 2, doc.internal.pageSize.width - margin, yPos + 2);
        yPos += lineHeight;
        doc.setFont('helvetica', 'normal');
      };

      const addField = (label: string, value: any) => {
        const displayValue = value !== null && value !== undefined ? String(value) : 'N/A';
        
        // Check if we need a new page
        if (yPos > doc.internal.pageSize.height - 20) {
          doc.addPage();
          yPos = 20;
        }
        
        doc.setFont('helvetica', 'bold');
        doc.text(`${label}: `, margin, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(displayValue, margin + 60, yPos);
        yPos += lineHeight;
      };
      
      // Document title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('SESSION REPORT', doc.internal.pageSize.width / 2, yPos, { align: 'center' });
      yPos += 10;
      
      doc.setFontSize(14);
      doc.text(`ID: ${sessionId}`, doc.internal.pageSize.width / 2, yPos, { align: 'center' });
      yPos += 10;
      
      doc.setFontSize(12);
      
      // 1. Basic Session Information
      addSectionHeading('SESSION INFORMATION');
      addField('Status', sessionData.status);
      addField('Created At', formatDate(sessionData.createdAt));
      addField('Source', sessionData.source || 'N/A');
      addField('Destination', sessionData.destination || 'N/A');
      addField('Company', sessionData.company?.name || 'N/A');
      addField('Created By', `${sessionData.createdBy?.name || 'N/A'} (${sessionData.createdBy?.email || 'N/A'})`);

      // 2. Seal Information
      addSectionHeading('SEAL INFORMATION');
      if (sessionData.seal) {
        addField('Barcode', sessionData.seal.barcode || 'N/A');
        addField('Status', sessionData.seal.verified ? 'Verified' : 'Not Verified');
        if (sessionData.seal.verified && sessionData.seal.verifiedBy) {
          addField('Verified By', sessionData.seal.verifiedBy.name || 'N/A');
          if (sessionData.seal.scannedAt) {
            addField('Verified At', formatDate(sessionData.seal.scannedAt));
          }
        }
      } else {
        yPos += lineHeight;
        doc.text('No seal information available', margin, yPos);
        yPos += lineHeight;
      }

      // 3. Trip Details
      addSectionHeading('TRIP DETAILS');
      
      // Define ordered fields for display
      const orderedFields = [
        // Vehicle information
        'vehicleNumber', 'transporterName', 
        // Driver information
        'driverName', 'driverContactNumber',
        // Material information
        'materialName', 'qualityOfMaterials', 'grossWeight', 'tareWeight', 'netMaterialWeight',
        // Document information
        'challanRoyaltyNumber', 'doNumber', 'tpNumber',
        // GPS information
        'gpsImeiNumber',
        // Loader information
        'loaderName', 'loaderMobileNumber',
        // Location information
        'loadingSite', 'receiverPartyName',
        // Financial information
        'freight'
      ];
      
      let tripDataDisplayed = false;
      
      // First display ordered fields
      for (const field of orderedFields) {
        if (field in allTripFields && allTripFields[field] !== undefined) {
          // Format field name for display
          const formattedField = field.replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
          
          addField(formattedField, allTripFields[field]);
          tripDataDisplayed = true;
        }
      }
      
      // Then display any other fields not in the ordered list
      for (const field of Object.keys(allTripFields)) {
        if (!orderedFields.includes(field) && allTripFields[field] !== undefined) {
          // Format field name for display
          const formattedField = field.replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
          
          addField(formattedField, allTripFields[field]);
          tripDataDisplayed = true;
        }
      }
      
      // Fallback message if no trip data
      if (!tripDataDisplayed) {
        doc.text('No trip details available', margin, yPos);
        yPos += lineHeight;
      }
      
      // 4. Images Information
      addSectionHeading('IMAGES INFORMATION');
      
      let imageDisplayed = false;
      
      // Helper to display image information
      const addImageField = (label: string, value: any) => {
        if (value) {
          if (Array.isArray(value)) {
            if (value.length > 0) {
              addField(label, `${value.length} available`);
              return true;
            }
          } else if (typeof value === 'string' && value.trim() !== '') {
            addField(label, 'Available');
            return true;
          } else if (typeof value === 'object' && value !== null) {
            const imageKeys = Object.keys(value).length;
            if (imageKeys > 0) {
              addField(label, `${imageKeys} entries available`);
              return true;
            }
          }
        }
        return false;
      };
      
      // Standard image fields
      if (imageInfo && Object.keys(imageInfo).length > 0) {
        const standardImageFields = [
          {key: 'driverPicture', label: 'Driver Picture'},
          {key: 'vehicleNumberPlatePicture', label: 'Vehicle Number Plate Picture'},
          {key: 'gpsImeiPicture', label: 'GPS IMEI Picture'},
          {key: 'sealingImages', label: 'Sealing Images'},
          {key: 'vehicleImages', label: 'Vehicle Images'},
          {key: 'additionalImages', label: 'Additional Images'}
        ];
        
        // Display standard fields
        for (const {key, label} of standardImageFields) {
          if (imageInfo[key] && addImageField(label, imageInfo[key])) {
            imageDisplayed = true;
          }
        }
        
        // Display any other image fields
        for (const key of Object.keys(imageInfo)) {
          if (!standardImageFields.some(field => field.key === key)) {
            const formattedKey = key.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            if (addImageField(formattedKey, imageInfo[key])) {
              imageDisplayed = true;
            }
          }
        }
      }
      
      // Fallback if no images
      if (!imageDisplayed) {
        addField("Images Status", "Not available for this session");
        addField("Image Types", "Typically includes driver, vehicle, and GPS pictures");
      }
      
      // 5. Verification Results
      addSectionHeading('VERIFICATION RESULTS');
      
      if (verificationDetails) {
        addField('Overall Status', verificationDetails.allMatch ? 'All fields match' : 'Some fields do not match');
        
        if (verificationDetails.fieldVerifications) {
          for (const [field, data] of Object.entries(verificationDetails.fieldVerifications)) {
            const formattedField = field.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            yPos += lineHeight * 0.5;
            addField(`${formattedField} - Operator`, data.operatorValue);
            addField(`${formattedField} - Guard`, data.guardValue);
            addField(`${formattedField} - Match`, data.operatorValue === data.guardValue ? 'Yes' : 'No');
            if (data.comment) {
              addField(`${formattedField} - Comment`, data.comment);
            }
          }
        }
      } else if (verificationLogs.length > 0) {
        // Show some basic verification info if available
        addField("Verification Logs Count", String(verificationLogs.length));
        
        const firstLog = verificationLogs[0];
        if (firstLog) {
          if (firstLog.action) {
            addField("Activity Type", firstLog.action);
          }
          if (firstLog.user?.name) {
            addField("Performed By", firstLog.user.name);
          }
          if (firstLog.createdAt) {
            addField("Performed At", formatDate(firstLog.createdAt));
          }
        }
        
        // Add seal verification status if available
        if (sessionData.seal?.verified !== undefined) {
          addField("Seal Verification Status", sessionData.seal.verified ? "Verified" : "Not Verified");
          
          if (sessionData.seal.verifiedBy?.name) {
            addField("Verified By", sessionData.seal.verifiedBy.name);
          }
          
          if (sessionData.seal.scannedAt) {
            addField("Verified At", formatDate(sessionData.seal.scannedAt));
          }
        }
      } else {
        // Fallback message if no verification data
        addField("Verification Status", "No verification has been performed");
        addField("Required Action", "Trip verification pending");
      }
      
      // Add footer with page numbers
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(10);
        doc.text(
          `Page ${i} of ${pageCount} | Generated on ${new Date().toLocaleString()}`,
          doc.internal.pageSize.width / 2,
          doc.internal.pageSize.height - 10,
          { align: 'center' }
        );
      }

      // Generate PDF buffer
      const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

      // Return the PDF file
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
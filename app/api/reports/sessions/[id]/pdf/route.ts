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
        
        // Try other potential places where trip data might be stored
        let otherPossibleTripFields: Record<string, any> = {};
        
        // Look for trip data in direct session fields (they may be at root level)
        const tripDataFieldNames = [
          // Standard fields
          'transporterName', 'materialName', 'vehicleNumber', 'gpsImeiNumber', 'driverName',
          'driverContactNumber', 'loaderName', 'loaderMobileNumber', 'challanRoyaltyNumber',
          'doNumber', 'tpNumber', 'qualityOfMaterials', 'freight', 'grossWeight',
          'tareWeight', 'netMaterialWeight', 'loadingSite', 'receiverPartyName',
          
          // Additional possible field names (with different casing or naming conventions)
          'transporter_name', 'material_name', 'vehicle_number', 'gps_imei', 'driver_name',
          'driver_contact', 'loader_name', 'loader_mobile', 'challan_number', 'royalty_number',
          'do_number', 'tp_number', 'quality', 'material_quality', 'material_weight',
          'gross_weight', 'tare_weight', 'net_weight', 'loading_site', 'receiver_name',
          'receiverName', 'receiverContact', 'receiver_contact', 'materialType', 'material_type',
          'vehicleType', 'vehicle_type', 'consignmentNumber', 'consignment_number',
          'customerName', 'customer_name', 'customerContact', 'customer_contact',
          'billingDetails', 'billing_details', 'paymentDetails', 'payment_details',
          
          // Additional expanded field names
          'consignor', 'consignee', 'originLocation', 'destinationLocation', 'origin_location', 
          'destination_location', 'pickupDate', 'deliveryDate', 'pickup_date', 'delivery_date', 
          'invoiceNumber', 'invoice_number', 'weightUnit', 'weight_unit', 'vehicleCapacity', 
          'vehicle_capacity', 'transitTime', 'transit_time', 'routeDetails', 'route_details',
          'permitNumber', 'permit_number', 'fuelType', 'fuel_type', 'driverLicense', 'driver_license',
          'insuranceDetails', 'insurance_details', 'maintenanceDetails', 'maintenance_details',
          'trackingNumber', 'tracking_number', 'paymentStatus', 'payment_status'
        ];
        
        // Check if any trip fields exist directly in the session object
        for (const field of tripDataFieldNames) {
          if (field in detailedSessionData && detailedSessionData[field as keyof typeof detailedSessionData] !== undefined) {
            otherPossibleTripFields[field] = detailedSessionData[field as keyof typeof detailedSessionData];
          }
        }
        
        // Also check in sessionData directly in case it has additional props
        for (const field of tripDataFieldNames) {
          if (field in sessionData && sessionData[field as keyof typeof sessionData] !== undefined) {
            otherPossibleTripFields[field] = sessionData[field as keyof typeof sessionData];
          }
        }
        
        // Check for JSON data in the session object
        const checkObjectForTripFields = (obj: any) => {
          for (const field of tripDataFieldNames) {
            if (field in obj) {
              otherPossibleTripFields[field] = obj[field];
            }
          }
        };
        
        for (const [key, value] of Object.entries(detailedSessionData)) {
          // Check if the field is a JSON string that we might need to parse
          if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
            try {
              const parsedValue = JSON.parse(value);
              // If it contains trip details, extract them
              if (parsedValue && typeof parsedValue === 'object') {
                checkObjectForTripFields(parsedValue);
                
                // Also check nested objects
                if (!Array.isArray(parsedValue)) {
                  for (const [nestedKey, nestedValue] of Object.entries(parsedValue)) {
                    if (nestedValue && typeof nestedValue === 'object') {
                      checkObjectForTripFields(nestedValue);
                    }
                  }
                }
              }
            } catch (e) {
              // Not valid JSON, ignore
            }
          }
          
          // Check if the field is an object that might contain trip details
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            checkObjectForTripFields(value);
            
            // Also check nested objects up to one level deep
            for (const [nestedKey, nestedValue] of Object.entries(value)) {
              if (nestedValue && typeof nestedValue === 'object' && !Array.isArray(nestedValue)) {
                checkObjectForTripFields(nestedValue);
              }
            }
          }
        }
        
        // Check for session data fields that might be arrays containing objects with trip details
        for (const [key, value] of Object.entries(detailedSessionData)) {
          if (Array.isArray(value)) {
            for (const item of value) {
              if (item && typeof item === 'object') {
                checkObjectForTripFields(item);
              }
            }
          }
        }
        
        // Merge both sources of trip details
        let completeDetails = { ...directTripDetails, ...otherPossibleTripFields };
        if (tripDetails && Object.keys(tripDetails).length > 0) {
          completeDetails = { ...completeDetails, ...tripDetails };
        }
        
        // Debug log the number of fields found
        console.log(`[PDF REPORT] Combined ${Object.keys(completeDetails).length} trip detail fields from all sources`);
        
        // Get all images
        const images = detailedSessionData.images || {};
        
        // Create PDF document that matches the details page UI
        const doc = new jsPDF();
        // Add autotable to the jsPDF instance
        (doc as any).autoTable = autoTable;
        
        // Add a title that matches the dashboard styling - CBUMS navbar blue
        doc.setFillColor(25, 118, 210); // CBUMS primary blue 
        doc.rect(0, 0, doc.internal.pageSize.getWidth(), 20, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text("CBUMS - Session Details", doc.internal.pageSize.getWidth() / 2, 12, { align: 'center' });
        
        // Add session ID with exact styling from the details page
        doc.setFillColor(245, 245, 245);
        doc.rect(0, 20, doc.internal.pageSize.getWidth(), 16, 'F');
        doc.setTextColor(80, 80, 80);
        doc.setFontSize(11);
        doc.text(`Session ID: ${sessionData.id}`, 10, 30);
        
        // Prepare status badge similar to UI - exact color mapping
        let statusColor;
        switch (sessionData.status) {
          case 'COMPLETED':
            statusColor = [46, 204, 113]; // Green
            break;
          case 'IN_PROGRESS':
            statusColor = [52, 152, 219]; // Blue
            break;
          case 'PENDING':
            statusColor = [243, 156, 18]; // Yellow/Orange
            break;
          case 'REJECTED':
            statusColor = [231, 76, 60]; // Red
            break;
          default:
            statusColor = [149, 165, 166]; // Gray
        }
        
        // Add status badge with rounded corners just like the UI
        const statusText = sessionData.status.replace(/_/g, ' ');
        doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.roundedRect(doc.internal.pageSize.getWidth() - 80, 23, 70, 10, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(9);
        doc.text(statusText, doc.internal.pageSize.getWidth() - 45, 29, { align: 'center' });
        
        // Main content Y position tracker - matches spacing in details page
        let yPos = 46;
        const leftMargin = 10;
        const lineHeight = 10;
        const sectionSpacing = 10;
        
        // ===================================================
        // SECTION 1: SESSION DETAILS - matches order on details page
        // ===================================================
        doc.setFillColor(237, 243, 248); // Light blue header background
        doc.rect(0, yPos, doc.internal.pageSize.getWidth(), 16, 'F');
        doc.setTextColor(44, 62, 80); // Dark blue text
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("Session Details", leftMargin, yPos + 11);
        yPos += 22;
        
        // Create a bordered table with white background - exactly like UI
        // We'll use autoTable but customize it to look like the UI tables
        (doc as any).autoTable({
          startY: yPos,
          head: [], // No header
          body: [
            [{ content: 'Created At', styles: { fontStyle: 'bold' } }, formatDate(sessionData.createdAt)],
            [{ content: 'Source', styles: { fontStyle: 'bold' } }, sessionData.source || 'N/A'],
            [{ content: 'Destination', styles: { fontStyle: 'bold' } }, sessionData.destination || 'N/A'],
            [{ content: 'Company', styles: { fontStyle: 'bold' } }, sessionData.company.name || 'N/A'],
            [{ content: 'Created By', styles: { fontStyle: 'bold' } }, sessionData.createdBy.name || 'N/A'],
            [{ content: 'Role', styles: { fontStyle: 'bold' } }, sessionData.createdBy.role || 'N/A']
          ],
          theme: 'grid', // Add borders
          styles: {
            fontSize: 10,
            cellPadding: 5,
          },
          columnStyles: {
            0: { cellWidth: 80, fillColor: [249, 249, 249] }, 
            1: { cellWidth: 'auto', fillColor: [255, 255, 255] },
          },
          margin: { left: leftMargin, right: leftMargin },
        });
        
        // Update yPos after the table
        yPos = (doc as any).lastAutoTable.finalY + sectionSpacing;
        
        // ===================================================
        // SECTION 2: IMAGES SECTION - follows the order in the details page
        // ===================================================
        if (images && Object.keys(images).length > 0) {
          doc.setFillColor(237, 243, 248); // Light blue header background
          doc.rect(0, yPos, doc.internal.pageSize.getWidth(), 16, 'F');
          doc.setTextColor(44, 62, 80); // Dark blue text
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text("Images", leftMargin, yPos + 11);
          yPos += 22;
          
          // Create a table of available images
          const imageData: string[][] = [];
          
          if (images.driverPicture) {
            imageData.push(['Driver Picture', 'Available']);
          }
          
          if (images.vehicleNumberPlatePicture) {
            imageData.push(['Vehicle Number Plate Picture', 'Available']);
          }
          
          if (images.gpsImeiPicture) {
            imageData.push(['GPS/IMEI Picture', 'Available']);
          }
          
          if (images.sealingImages && images.sealingImages.length > 0) {
            imageData.push(['Sealing Images', `${images.sealingImages.length} available`]);
          }
          
          if (images.vehicleImages && images.vehicleImages.length > 0) {
            imageData.push(['Vehicle Images', `${images.vehicleImages.length} available`]);
          }
          
          if (images.additionalImages && images.additionalImages.length > 0) {
            imageData.push(['Additional Images', `${images.additionalImages.length} available`]);
          }
          
          if (imageData.length > 0) {
            (doc as any).autoTable({
              startY: yPos,
              head: [],
              body: imageData.map(row => [
                { content: row[0], styles: { fontStyle: 'bold' } },
                row[1]
              ]),
              theme: 'grid',
              styles: {
                fontSize: 10,
                cellPadding: 5,
              },
              columnStyles: {
                0: { cellWidth: 120, fillColor: [249, 249, 249] },
                1: { cellWidth: 'auto', fillColor: [255, 255, 255] },
              },
              margin: { left: leftMargin, right: leftMargin },
            });
            
            yPos = (doc as any).lastAutoTable.finalY + sectionSpacing;
          } else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text("No images available", leftMargin, yPos);
            yPos += lineHeight + sectionSpacing;
          }
        }
        
        // ===================================================
        // SECTION 3: TRIP DETAILS - third section as per the UI
        // ===================================================
        doc.setFillColor(237, 243, 248); // Light blue header background
        doc.rect(0, yPos, doc.internal.pageSize.getWidth(), 16, 'F');
        doc.setTextColor(44, 62, 80); // Dark blue text 
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text("Trip Details", leftMargin, yPos + 11);
        yPos += 22;
        
        // Prepare trip details for autotable
        const tripDetailsData: (string | number | null)[][] = [];
        
        // Define field order and grouping to match UI
        const fieldMappings = [
          { key: 'transporterName', label: 'Transporter Name' },
          { key: 'materialName', label: 'Material Name' },
          { key: 'vehicleNumber', label: 'Vehicle Number' },
          { key: 'gpsImeiNumber', label: 'GPS IMEI Number' },
          { key: 'driverName', label: 'Driver Name' },
          { key: 'driverContactNumber', label: 'Driver Contact Number' },
          { key: 'loaderName', label: 'Loader Name' },
          { key: 'loaderMobileNumber', label: 'Loader Mobile Number' },
          { key: 'challanRoyaltyNumber', label: 'Challan/Royalty Number' },
          { key: 'doNumber', label: 'DO Number' },
          { key: 'tpNumber', label: 'TP Number' },
          { key: 'qualityOfMaterials', label: 'Quality of Materials' },
          { key: 'freight', label: 'Freight' },
          { key: 'grossWeight', label: 'Gross Weight (kg)' },
          { key: 'tareWeight', label: 'Tare Weight (kg)' },
          { key: 'netMaterialWeight', label: 'Net Material Weight (kg)' },
          { key: 'loadingSite', label: 'Loading Site' },
          { key: 'receiverPartyName', label: 'Receiver Party Name' }
        ];
        
        // Add known fields first in a specific order
        for (const field of fieldMappings) {
          if (field.key in completeDetails) {
            const value = completeDetails[field.key as keyof typeof completeDetails];
            const displayValue = value !== undefined && value !== null ? String(value) : 'N/A';
            tripDetailsData.push([field.label, displayValue]);
          }
        }
        
        // Add any other fields that weren't in our mapping
        for (const [key, value] of Object.entries(completeDetails)) {
          if (!fieldMappings.some(field => field.key === key)) {
            // Format key from camelCase to Title Case with spaces
            const formattedKey = key.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            const displayValue = value !== undefined && value !== null ? String(value) : 'N/A';
            tripDetailsData.push([formattedKey, displayValue]);
          }
        }
        
        // Auto-table for trip details that exactly matches the Session Details UI table style
        (doc as any).autoTable({
          startY: yPos,
          head: [], // No header to match UI
          body: tripDetailsData.map(row => [
            { content: row[0], styles: { fontStyle: 'bold' } },
            row[1]
          ]),
          theme: 'grid',
          styles: {
            fontSize: 10,
            cellPadding: 5,
          },
          columnStyles: {
            0: { cellWidth: 120, fillColor: [249, 249, 249] },
            1: { cellWidth: 'auto', fillColor: [255, 255, 255] },
          },
          margin: { left: leftMargin, right: leftMargin },
        });
        
        // Update yPos after the table
        yPos = (doc as any).lastAutoTable.finalY + sectionSpacing;
        
        // ===================================================
        // SECTION 4: SEAL INFORMATION - if available
        // ===================================================
        if (sessionData.seal) {
          doc.setFillColor(237, 243, 248); // Light blue header background
          doc.rect(0, yPos, doc.internal.pageSize.getWidth(), 16, 'F');
          doc.setTextColor(44, 62, 80); // Dark blue text
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text("Seal Information", leftMargin, yPos + 11);
          yPos += 22;
          
          // Add seal information
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
          
          (doc as any).autoTable({
            startY: yPos,
            head: [],
            body: sealData,
            theme: 'grid',
            styles: {
              fontSize: 10,
              cellPadding: 5,
            },
            columnStyles: {
              0: { cellWidth: 80, fillColor: [249, 249, 249] },
              1: { cellWidth: 'auto', fillColor: [255, 255, 255] },
            },
            margin: { left: leftMargin, right: leftMargin },
          });
          
          yPos = (doc as any).lastAutoTable.finalY + sectionSpacing;
        }
        
        // ===================================================
        // SECTION 5: COMMENTS SECTION - if available
        // ===================================================
        if (sessionData.comments && sessionData.comments.length > 0) {
          doc.setFillColor(237, 243, 248); // Light blue header background
          doc.rect(0, yPos, doc.internal.pageSize.getWidth(), 16, 'F');
          doc.setTextColor(44, 62, 80); // Dark blue text
          doc.setFontSize(12);
          doc.setFont('helvetica', 'bold');
          doc.text("Comments", leftMargin, yPos + 11);
          yPos += 22;
          
          // Create an array to hold comment data
          const commentData: any[] = [];
          
          for (let i = 0; i < Math.min(sessionData.comments.length, 5); i++) {
            try {
              const comment = sessionData.comments[i];
              const userName = comment.user?.name || 'Unknown';
              const commentDate = formatDate(comment.createdAt);
              const commentText = comment.message || '(No text)';
              
              // Add each comment as a row in our table
              commentData.push([
                { content: `${userName} (${commentDate})`, styles: { fontStyle: 'bold' } },
                commentText
              ]);
            } catch {
              console.error(`Error processing comment ${i}`);
              continue;
            }
          }
          
          if (commentData.length > 0) {
            (doc as any).autoTable({
              startY: yPos,
              head: [],
              body: commentData,
              theme: 'grid',
              styles: {
                fontSize: 10,
                cellPadding: 5,
              },
              columnStyles: {
                0: { cellWidth: 120, fillColor: [249, 249, 249] },
                1: { cellWidth: 'auto', fillColor: [255, 255, 255] },
              },
              margin: { left: leftMargin, right: leftMargin },
            });
            
            yPos = (doc as any).lastAutoTable.finalY + sectionSpacing;
          } else {
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text("No comments available", leftMargin, yPos);
            yPos += lineHeight + sectionSpacing;
          }
        }
        
        // Add footer
        const pageCount = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text(
            `Page ${i} of ${pageCount} - Generated on ${new Date().toLocaleString()}`,
            doc.internal.pageSize.getWidth() / 2,
            doc.internal.pageSize.getHeight() - 10,
            { align: 'center' }
          );
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
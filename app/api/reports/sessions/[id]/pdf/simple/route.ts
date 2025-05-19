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

// Generate a simple text-based report for session
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
      
      // Fetch the session with ALL related data
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
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
      
      // Get direct session data (for fields that might not be in activityLog)
      const directTripDetails = sessionData.tripDetails || {};
      
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
      
      for (const [key, value] of Object.entries(sessionData)) {
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
      for (const [key, value] of Object.entries(sessionData)) {
        if (Array.isArray(value)) {
          for (const item of value) {
            if (item && typeof item === 'object') {
              checkObjectForTripFields(item);
            }
          }
        }
      }
      
      // Get all images data
      const images = sessionData.images || {};
      
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
      
      // Format date helper
      const formatDate = (date: Date | string) => {
        try {
          return new Date(date).toLocaleString();
        } catch {
          return String(date);
        }
      };
      
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
      
      // Combine trip details from both sources
      let completeDetails = { ...directTripDetails, ...otherPossibleTripFields };
      if (tripDetails && Object.keys(tripDetails).length > 0) {
        completeDetails = { ...completeDetails, ...tripDetails };
      }
      
      // Add debug log 
      console.log(`[TEXT REPORT] Combined ${Object.keys(completeDetails).length} trip detail fields from all sources`);
      
      // Fetch verification activity logs
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
              id: true,
              name: true,
              role: true,
              subrole: true
            }
          }
        }
      });
      
      // Build text report sections
      const sections: string[] = [];
      
      // Title with better formatting
      sections.push("=================================================================");
      sections.push("                         SESSION REPORT                          ");
      sections.push("=================================================================");
      sections.push("            CBUMS - Consignment & Barcode Utilization System     ");
      sections.push("=================================================================");
      sections.push("");
      
      // Format helper for section headers
      const formatSectionHeader = (title: string) => {
        const line = "=".repeat(title.length + 4);
        return [
          line,
          `| ${title} |`,
          line
        ].join('\n');
      };
      
      // Format helper for key-value pairs
      const formatKeyValue = (key: string, value: any) => {
        const displayValue = value !== null && value !== undefined ? value : 'N/A';
        // Pad the key to a fixed width for alignment
        const paddedKey = key.padEnd(30, ' ');
        return `${paddedKey}: ${displayValue}`;
      };
      
      // Session Information
      sections.push(formatSectionHeader("SESSION INFORMATION"));
      sections.push(formatKeyValue("Session ID", sessionData.id));
      sections.push(formatKeyValue("Status", sessionData.status));
      sections.push(formatKeyValue("Created At", formatDate(sessionData.createdAt)));
      sections.push(formatKeyValue("Source", sessionData.source || 'N/A'));
      sections.push(formatKeyValue("Destination", sessionData.destination || 'N/A'));
      sections.push(formatKeyValue("Company", sessionData.company?.name || 'N/A'));
      sections.push(formatKeyValue("Created By", `${sessionData.createdBy?.name || 'N/A'} (${sessionData.createdBy?.email || 'N/A'})`));
      sections.push("");
      
      // Seal Information
      sections.push(formatSectionHeader("SEAL INFORMATION"));
      if (sessionData.seal) {
        sections.push(formatKeyValue("Barcode", sessionData.seal.barcode || 'N/A'));
        sections.push(formatKeyValue("Status", sessionData.seal.verified ? 'Verified' : 'Not Verified'));
        if (sessionData.seal.verified && sessionData.seal.verifiedBy) {
          sections.push(formatKeyValue("Verified By", sessionData.seal.verifiedBy.name || 'N/A'));
          if (sessionData.seal.scannedAt) {
            sections.push(formatKeyValue("Verified At", formatDate(sessionData.seal.scannedAt)));
          }
        }
      } else {
        sections.push("No seal information available");
      }
      sections.push("");
      
      // Trip Details
      sections.push(formatSectionHeader("TRIP DETAILS"));
      if (Object.keys(completeDetails).length > 0) {
        // Define comprehensive list of trip detail fields with labels
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
            const value = completeDetails[key as keyof typeof completeDetails];
            sections.push(formatKeyValue(label, value));
          }
        }
        
        // Then add any other fields that might exist
        for (const [key, value] of Object.entries(completeDetails)) {
          if (!(key in fieldLabels)) {
            // Format key from camelCase to Title Case with spaces
            const formattedKey = key.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            sections.push(formatKeyValue(formattedKey, value));
          }
        }
      } else {
        sections.push("No trip details available");
      }
      sections.push("");
      
      // Images Information
      sections.push(formatSectionHeader("IMAGES INFORMATION"));
      
      if (images && Object.keys(images).length > 0) {
        if (images.driverPicture) {
          sections.push(formatKeyValue("Driver Picture", "Available"));
        }
        
        if (images.vehicleNumberPlatePicture) {
          sections.push(formatKeyValue("Vehicle Number Plate Picture", "Available"));
        }
        
        if (images.gpsImeiPicture) {
          sections.push(formatKeyValue("GPS/IMEI Picture", "Available"));
        }
        
        if (images.sealingImages && images.sealingImages.length > 0) {
          sections.push(formatKeyValue("Sealing Images", `${images.sealingImages.length} available`));
        }
        
        if (images.vehicleImages && images.vehicleImages.length > 0) {
          sections.push(formatKeyValue("Vehicle Images", `${images.vehicleImages.length} available`));
        }
        
        if (images.additionalImages && images.additionalImages.length > 0) {
          sections.push(formatKeyValue("Additional Images", `${images.additionalImages.length} available`));
        }
      } else {
        sections.push("No images available");
      }
      sections.push("");
      
      // Verification Results
      sections.push(formatSectionHeader("VERIFICATION RESULTS"));
      const verificationDetails = verificationLogs.find((log: any) => 
        log.details && typeof log.details === 'object' && 'verification' in log.details
      );
      
      if (verificationDetails?.details) {
        const details = verificationDetails.details as unknown as { verification: VerificationDetails };
        const verification = details.verification;
        
        sections.push(formatKeyValue("Overall Status", verification.allMatch ? 'All fields match' : 'Some fields do not match'));
        sections.push("");
        
        for (const [field, data] of Object.entries(verification.fieldVerifications)) {
          const formattedField = field.replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
          
          sections.push(`${formattedField}:`);
          sections.push(formatKeyValue("  Operator Value", data.operatorValue));
          sections.push(formatKeyValue("  Guard Value", data.guardValue));
          sections.push(formatKeyValue("  Match", data.operatorValue === data.guardValue ? 'Yes' : 'No'));
          if (data.comment) {
            sections.push(formatKeyValue("  Comment", data.comment));
          }
          sections.push("");
        }
      } else {
        sections.push("No verification data available");
      }
      sections.push("");
      
      // Comments
      sections.push(formatSectionHeader("COMMENTS"));
      if (sessionData.comments && sessionData.comments.length > 0) {
        for (const comment of sessionData.comments) {
          const userName = comment.user?.name || 'Unknown';
          const commentDate = formatDate(comment.createdAt);
          const commentText = comment.message || '(No text)';
          
          sections.push(`${userName} on ${commentDate}:`);
          sections.push(`  ${commentText}`);
          sections.push("");
        }
      } else {
        sections.push("No comments available");
      }
      
      // Add a separator at the end
      sections.push("=================================================================");
      sections.push("                         END OF REPORT                          ");
      sections.push("=================================================================");
      
      // Join all sections with newlines
      const reportText = sections.join('\n');
      
      // Create PDF document instead of returning text
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

      let yPos = 50;

      // Session Information
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Basic Information', 20, yPos);
      doc.setFontSize(10);
      
      const basicInfo = [
        ['Source', sessionData.source || 'N/A'],
        ['Destination', sessionData.destination || 'N/A'],
        ['Created', formatDate(sessionData.createdAt)],
        ['Company', sessionData.company.name || 'N/A'],
      ];

      autoTable(doc, {
        startY: yPos + 5,
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
      yPos = doc.lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Trip Details', 20, yPos);
      doc.setFontSize(10);

      // Format trip details as rows for the table
      const tripDetailsRows = Object.entries(completeDetails).map(([key, value]) => {
        // Format key from camelCase to Title Case with spaces
        const formattedKey = key.replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());
        return [formattedKey, value !== null && value !== undefined ? String(value) : 'N/A'];
      });

      if (tripDetailsRows.length > 0) {
        autoTable(doc, {
          startY: yPos + 5,
          head: [],
          body: tripDetailsRows,
          theme: 'grid',
          styles: { fontSize: 10 },
          columnStyles: {
            0: { cellWidth: 60, fontStyle: 'bold' },
            1: { cellWidth: 110 }
          }
        });
      } else {
        yPos += 5;
        doc.setFont('helvetica', 'normal');
        doc.text('No trip details available', 20, yPos);
      }

      // Seal Information
      yPos = doc.lastAutoTable.finalY + 10;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('Seal Information', 20, yPos);
      doc.setFontSize(10);

      const sealInfo = [
        ['Barcode', sessionData.seal?.barcode || 'N/A'],
        ['Status', sessionData.seal?.verified ? 'Verified' : 'Unverified'],
      ];

      if (sessionData.seal?.verified && sessionData.seal?.verifiedBy) {
        sealInfo.push(['Verified By', sessionData.seal.verifiedBy.name || 'N/A']);
      }

      if (sessionData.seal?.verified && sessionData.seal?.scannedAt) {
        sealInfo.push(['Verified At', formatDate(sessionData.seal.scannedAt)]);
      }

      autoTable(doc, {
        startY: yPos + 5,
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
      console.error("Error generating text report:", error);
      return NextResponse.json(
        { error: "Failed to generate text report", details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY]
); 
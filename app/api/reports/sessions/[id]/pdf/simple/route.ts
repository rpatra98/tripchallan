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
      
      // Log entire session data to understand its structure
      console.log("Full Session Data Structure:", 
                 Object.keys(sessionData).join(', '));
      
      // For debugging - dump entire session data to see what's available
      // We'll limit to first level to avoid logging too much data
      const sessionDataLimitedLog: Record<string, any> = {};
      for (const [key, value] of Object.entries(sessionData)) {
        if (typeof value !== 'object' || value === null) {
          sessionDataLimitedLog[key] = value;
        } else if (Array.isArray(value)) {
          sessionDataLimitedLog[key] = `Array with ${value.length} items`;
        } else {
          sessionDataLimitedLog[key] = `Object with keys: ${Object.keys(value).join(', ')}`;
        }
      }
      console.log("Session Data Overview:", JSON.stringify(sessionDataLimitedLog, null, 2));
      
      // Get direct session data (for fields that might not be in activityLog)
      const directTripDetails = sessionData.tripDetails || {};
      
      // Enhanced debug logging
      console.log("Direct Trip Details from sessionData.tripDetails:", 
        directTripDetails ? JSON.stringify(directTripDetails) : "None");
      
      // Try other potential places where trip data might be stored
      let otherPossibleTripFields: Record<string, any> = {};
      
      // First check for direct fields in the session (top level)
      for (const fieldName of ['vehicleNumber', 'driverName', 'freight', 'transporterName', 
                              'driverContactNumber', 'materialName', 'gpsImeiNumber']) {
        if (sessionData[fieldName as keyof typeof sessionData] !== undefined && 
            sessionData[fieldName as keyof typeof sessionData] !== null) {
          otherPossibleTripFields[fieldName] = sessionData[fieldName as keyof typeof sessionData];
        }
      }
      
      // Check for JSON data in the session object
      const checkObjectForTripFields = (obj: any) => {
        for (const field of ['vehicleNumber', 'driverName', 'freight', 'transporterName', 
                            'driverContactNumber', 'materialName', 'gpsImeiNumber']) {
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
      console.log("Images data available:", Object.keys(images).length > 0 ? "Yes" : "No", 
                  Object.keys(images));
      
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
      
      // If we still have no trip details, add fallback data from session
      if (Object.keys(completeDetails).length === 0) {
        // Check for common fields directly in session
        for (const field of ['vehicleNumber', 'driverName', 'freight', 'transporterName', 
                           'driverContactNumber', 'materialName', 'gpsImeiNumber']) {
          if (sessionData[field as keyof typeof sessionData]) {
            completeDetails[field] = sessionData[field as keyof typeof sessionData];
          }
        }
      }
      
      // Add debug log 
      console.log(`[PDF REPORT] Combined ${Object.keys(completeDetails).length} trip detail fields from all sources`);
      console.log("Complete trip details:", JSON.stringify(completeDetails, null, 2));
      
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
      
      // Create PDF document with simpler settings
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Basic fonts and settings
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(12);

      // Add title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('SESSION REPORT', doc.internal.pageSize.width / 2, 20, { align: 'center' });
      doc.setFontSize(14);
      doc.text(`ID: ${sessionData.id}`, doc.internal.pageSize.width / 2, 30, { align: 'center' });
      doc.setFontSize(12);

      // Set margin
      const margin = 20;
      let yPos = 40;
      const lineHeight = 7;

      // Helper to add a section heading
      const addSectionHeading = (text: string) => {
        doc.setFont('helvetica', 'bold');
        yPos += lineHeight * 1.5;
        doc.text(text, margin, yPos);
        doc.line(margin, yPos + 2, doc.internal.pageSize.width - margin, yPos + 2);
        yPos += lineHeight;
        doc.setFont('helvetica', 'normal');
      };

      // Helper to add a field with label
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

      // BASIC SESSION INFORMATION
      addSectionHeading('SESSION INFORMATION');
      addField('Status', sessionData.status);
      addField('Created At', formatDate(sessionData.createdAt));
      addField('Source', sessionData.source || 'N/A');
      addField('Destination', sessionData.destination || 'N/A');
      addField('Company', sessionData.company?.name || 'N/A');
      addField('Created By', `${sessionData.createdBy?.name || 'N/A'} (${sessionData.createdBy?.email || 'N/A'})`);

      // SEAL INFORMATION
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

      // TRIP DETAILS - show ALL available details
      addSectionHeading('TRIP DETAILS');
      
      // Try multiple sources for trip details, in order of likelihood
      const tripSources = [
        // Try directTripDetails first
        {name: "tripDetails field", data: sessionData.tripDetails},
        // Try directly looking at top-level fields in the session
        {name: "direct session fields", data: (() => {
          const direct: Record<string, any> = {};
          const commonFields = ['vehicleNumber', 'driverName', 'driverContactNumber', 'freight', 
                              'transporterName', 'materialName', 'gpsImeiNumber', 'challanRoyaltyNumber',
                              'doNumber', 'tpNumber', 'grossWeight', 'tareWeight', 'loadingSite'];
          for (const field of commonFields) {
            if (field in sessionData) {
              direct[field] = sessionData[field as keyof typeof sessionData];
            }
          }
          return Object.keys(direct).length > 0 ? direct : null;
        })()},
        // Try looking in activityLog if it exists
        {name: "activity log", data: (() => {
          if (activityLog?.details) {
            if (typeof activityLog.details === 'string') {
              try {
                const parsed = JSON.parse(activityLog.details);
                return parsed.tripDetails || parsed.data?.tripDetails || null;
              } catch {
                return null;
              }
            } else {
              return activityLog.details.tripDetails || activityLog.details.data?.tripDetails || null;
            }
          }
          return null;
        })()},
        // Last resort - show everything that might be trip-related
        {name: "all possible fields", data: completeDetails}
      ];
      
      // Try each source until we find one with data
      let tripDataDisplayed = false;
      for (const source of tripSources) {
        if (source.data && Object.keys(source.data).length > 0) {
          console.log(`Using trip details from ${source.name}`);
          
          // Display all the key-value pairs from this source
          for (const [key, value] of Object.entries(source.data)) {
            if (value !== undefined) {
              // Format key from camelCase to Title Case with spaces
              const formattedKey = key.replace(/([A-Z])/g, ' $1')
                .replace(/^./, str => str.toUpperCase());
              
              addField(formattedKey, value);
              tripDataDisplayed = true;
            }
          }
          
          // Once we've displayed data from a source, we're done
          break;
        }
      }
      
      // If no data was displayed from any source, show the fallback message
      if (!tripDataDisplayed) {
        console.log("No trip details found in any source");
        yPos += lineHeight;
        doc.text('No trip details available', margin, yPos);
        yPos += lineHeight;
      }

      // IMAGES INFORMATION - simplified to directly display whatever is in the images object
      addSectionHeading('IMAGES INFORMATION');
      
      // Check directly if the images field exists and has content
      const imageData = sessionData.images as Record<string, any> | undefined;
      let imageInfoDisplayed = false;
      
      if (imageData && typeof imageData === 'object') {
        console.log("Images data found:", Object.keys(imageData));
        
        // Handle each possible image field
        const imageFields = [
          {key: 'driverPicture', label: 'Driver Picture'},
          {key: 'vehicleNumberPlatePicture', label: 'Vehicle Number Plate Picture'},
          {key: 'gpsImeiPicture', label: 'GPS IMEI Picture'}
        ];
        
        // Process single image fields
        for (const {key, label} of imageFields) {
          if (imageData[key]) {
            addField(label, 'Available');
            imageInfoDisplayed = true;
          }
        }
        
        // Process array image fields
        const arrayImageFields = [
          {key: 'sealingImages', label: 'Sealing Images'},
          {key: 'vehicleImages', label: 'Vehicle Images'},
          {key: 'additionalImages', label: 'Additional Images'}
        ];
        
        for (const {key, label} of arrayImageFields) {
          if (Array.isArray(imageData[key]) && imageData[key].length > 0) {
            addField(label, `${imageData[key].length} available`);
            imageInfoDisplayed = true;
          }
        }
        
        // Add any other keys in the images object that we didn't explicitly check
        const otherKeys = Object.keys(imageData).filter(key => 
          !imageFields.some(f => f.key === key) && 
          !arrayImageFields.some(f => f.key === key)
        );
        
        for (const key of otherKeys) {
          if (imageData[key]) {
            const formattedKey = key.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            if (Array.isArray(imageData[key])) {
              addField(formattedKey, `${imageData[key].length} available`);
            } else {
              addField(formattedKey, 'Available');
            }
            imageInfoDisplayed = true;
          }
        }
      } else {
        console.log("No images data found in sessionData");
      }
      
      // If we couldn't find any image data, show a fallback message
      if (!imageInfoDisplayed) {
        yPos += lineHeight;
        doc.text('No images available', margin, yPos);
        yPos += lineHeight;
      }

      // VERIFICATION RESULTS
      addSectionHeading('VERIFICATION RESULTS');
      const verificationInfo = verificationLogs.find((log: any) => 
        log.details && typeof log.details === 'object' && 'verification' in log.details
      );
      
      if (verificationInfo?.details) {
        const details = verificationInfo.details as unknown as { verification: VerificationDetails };
        const verification = details.verification;
        
        addField('Overall Status', verification.allMatch ? 'All fields match' : 'Some fields do not match');
        
        for (const [field, data] of Object.entries(verification.fieldVerifications)) {
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
      } else {
        yPos += lineHeight;
        doc.text('No verification data available', margin, yPos);
        yPos += lineHeight;
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
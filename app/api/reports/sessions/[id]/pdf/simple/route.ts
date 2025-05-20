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
      
      // Log raw image data from session
      console.log(`Raw sessionData.images:`, JSON.stringify(sessionData.images || {}));
      
      if (sessionData.images && typeof sessionData.images === 'object') {
        imageInfo = sessionData.images;
        console.log(`Found ${Object.keys(imageInfo).length} image references in sessionData.images:`, Object.keys(imageInfo).join(', '));
      }
      
      // If no images found in sessionData, try to extract from activityLog
      if (Object.keys(imageInfo).length === 0) {
        console.log("No images found in sessionData, checking activity logs");
        
        // Look for an activity log that contains images
        const imageLog = tripActivityLog || verificationLogs.find((log: any) => {
          if (!log.details) return false;
          
          let details = log.details;
          if (typeof details === 'string') {
            try { details = JSON.parse(details); } 
            catch { return false; }
          }
          
          return (
            details.imageBase64Data || 
            details.images || 
            (details.tripDetails && details.tripDetails.images)
          );
        });
        
        if (imageLog?.details) {
          let details = imageLog.details;
          
          if (typeof details === 'string') {
            try { details = JSON.parse(details); } 
            catch (e) { console.error("Failed to parse image log details:", e); }
          }
          
          // Extract image URLs
          if (details.images) {
            imageInfo = details.images;
            console.log(`Found image URLs in activity log: ${Object.keys(imageInfo).join(', ')}`);
          } else if (details.tripDetails?.images) {
            imageInfo = details.tripDetails.images;
            console.log(`Found image URLs in tripDetails: ${Object.keys(imageInfo).join(', ')}`);
          }
          
          // Extract base64 data if available (for direct embedding)
          if (details.imageBase64Data) {
            console.log(`Found direct imageBase64Data in activity log`);
            // We'll handle this specially in the image display section
          }
        }
      }
      
      // If no images found in sessionData or activityLog, try using the test PDF data
      if (Object.keys(imageInfo).length === 0) {
        try {
          console.log(`Trying to load image URLs from PDF data file for session ${sessionId}`);
          const fs = require('fs');
          const path = require('path');
          const dataPath = path.join(process.cwd(), `pdf-data-${sessionId}.json`);
          
          if (fs.existsSync(dataPath)) {
            const pdfData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
            if (pdfData.imageInfo && Object.keys(pdfData.imageInfo).length > 0) {
              imageInfo = pdfData.imageInfo;
              console.log(`Loaded ${Object.keys(imageInfo).length} image URLs from PDF data file`);
            }
          }
        } catch (error) {
          console.error("Error loading PDF data from file:", error);
        }
      }
      
      // Final fallback: Generate direct API URLs based on session ID
      if (Object.keys(imageInfo).length === 0) {
        console.log("Using fallback to generate direct API image URLs");
        const domain = 'https://tripchallan.vercel.app';
        
        // Create image URL for each type using the correct format as seen in the details page
        imageInfo = {
          driverPicture: `${domain}/api/images/${sessionId}/driver`,
          vehicleNumberPlatePicture: `${domain}/api/images/${sessionId}/vehicleNumber`,
          gpsImeiPicture: `${domain}/api/images/${sessionId}/gpsImei`,
          sealingImages: [],
          vehicleImages: [],
          additionalImages: []
        };
        
        // Create numbered URLs for array types - testing indices 0-4 for each type
        for (let i = 0; i < 5; i++) {
          imageInfo.sealingImages.push(`${domain}/api/images/${sessionId}/sealing/${i}`);
          imageInfo.vehicleImages.push(`${domain}/api/images/${sessionId}/vehicle/${i}`);
          imageInfo.additionalImages.push(`${domain}/api/images/${sessionId}/additional/${i}`);
        }
        
        console.log(`Generated direct API image URLs for all image types with pattern: ${domain}/api/images/${sessionId}/*`);
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
      
      // Image settings
      const imageSize = 50; // Size in mm for images
      const imagesPerRow = 2; // Images per row
      const imagesPerPage = 6; // Maximum images per page
      let imageCounter = 0; // Counter for images added to the current page
      
      // Helper function to fetch image data from API endpoint
      const fetchImageData = async (imageUrl: string): Promise<string | null> => {
        try {
          // Skip if URL is not defined
          if (!imageUrl) {
            console.log('Skipping undefined image URL');
            return null;
          }
          
          // Convert relative URLs to absolute URLs with the correct domain
          const apiDomain = 'https://tripchallan.vercel.app';
          let fullUrl = imageUrl;
          
          // Handle relative paths
          if (imageUrl.startsWith('/')) {
            fullUrl = `${apiDomain}${imageUrl}`;
          } else if (!imageUrl.startsWith('http')) {
            fullUrl = `${apiDomain}/${imageUrl}`;
          }
          
          console.log(`Fetching image from: ${fullUrl}`);
          
          // Fetch the image with proper cache control and headers
          const response = await fetch(fullUrl, {
            method: 'GET',
            headers: {
              'Accept': 'image/*, */*',
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            },
            cache: 'no-store',
            next: { revalidate: 0 }
          });
          
          if (!response.ok) {
            console.error(`Failed to fetch image (${response.status}): ${fullUrl}`);
            return null;
          }
          
          // Convert to blob and then to base64
          const blob = await response.blob();
          if (blob.size === 0) {
            console.error(`Retrieved empty image from: ${fullUrl}`);
            return null;
          }
          
          console.log(`Successfully loaded image (${blob.size} bytes): ${fullUrl}`);
          
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch (error) {
          console.error(`Error fetching image from ${imageUrl}:`, error);
          return null;
        }
      };
      
      // Function to directly add base64 image data to PDF
      const addBase64ImageToPdf = (imageData: string, label: string): boolean => {
        try {
          if (!imageData) return false;
          
          // Check if we need to start a new page
          if (imageCounter >= imagesPerPage) {
            doc.addPage();
            yPos = 20;
            imageCounter = 0;
          }
          
          // Calculate position
          const column = imageCounter % imagesPerRow;
          const xPos = margin + column * (imageSize + 20); // 20mm gap between columns
          
          // If starting a new row, adjust yPos
          if (column === 0 && imageCounter > 0) {
            yPos += 5; // Add small gap between rows
          }
          
          // Add label for the image
          doc.setFont('helvetica', 'bold');
          doc.text(label, xPos, yPos);
          yPos += 5;
          
          // Add image (50x50px size)
          doc.addImage(imageData, 'AUTO', xPos, yPos, imageSize, imageSize);
          
          // Only increment yPos when row is complete
          if (column === imagesPerRow - 1) {
            yPos += imageSize + 10; // Image height + margin
          }
          
          // Increment counter
          imageCounter++;
          
          return true;
        } catch (error) {
          console.error(`Error adding base64 image ${label}:`, error);
          return false;
        }
      };
      
      // Helper function to add images to PDF
      const addImageToPdf = async (imageUrl: string, label: string): Promise<boolean> => {
        try {
          const imageData = await fetchImageData(imageUrl);
          if (!imageData) return false;
          
          // Check if we need to start a new page
          if (imageCounter >= imagesPerPage) {
            doc.addPage();
            yPos = 20;
            imageCounter = 0;
          }
          
          // Calculate position
          const column = imageCounter % imagesPerRow;
          const xPos = margin + column * (imageSize + 20); // 20mm gap between columns
          
          // If starting a new row, adjust yPos
          if (column === 0 && imageCounter > 0) {
            yPos += 5; // Add small gap between rows
          }
          
          // Add label for the image
          doc.setFont('helvetica', 'bold');
          doc.text(label, xPos, yPos);
          yPos += 5;
          
          // Add image (50x50px size)
          doc.addImage(imageData, 'AUTO', xPos, yPos, imageSize, imageSize);
          
          // Only increment yPos when row is complete
          if (column === imagesPerRow - 1) {
            yPos += imageSize + 10; // Image height + margin
          }
          
          // Increment counter
          imageCounter++;
          
          return true;
        } catch (error) {
          console.error(`Error adding image ${label}:`, error);
          return false;
        }
      };

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
      
      // Check for direct base64 data in any activity log
      const findBase64ImageData = (): Record<string, any> | null => {
        // Try to find in the main activityLog first
        if (tripActivityLog?.details) {
          let details = tripActivityLog.details;
          if (typeof details === 'string') {
            try { details = JSON.parse(details); } catch (e) { /* ignore */ }
          }
          
          if (details?.imageBase64Data) return details.imageBase64Data;
        }
        
        // Search through verification logs
        for (const log of verificationLogs) {
          if (!log.details) continue;
          
          let details = log.details;
          if (typeof details === 'string') {
            try { details = JSON.parse(details); } catch (e) { continue; }
          }
          
          if (details?.imageBase64Data) return details.imageBase64Data;
        }
        
        return null;
      };
      
      // Try to get base64 image data directly
      const base64Images = findBase64ImageData();
      
      // Add images to the PDF
      if (base64Images) {
        // Add single images from base64 data
        const singleImages = [
          { key: 'driverPicture', label: 'Driver Picture' },
          { key: 'vehicleNumberPlatePicture', label: 'Vehicle Plate' },
          { key: 'gpsImeiPicture', label: 'GPS/IMEI Picture' }
        ];
        
        for (const { key, label } of singleImages) {
          if (base64Images[key]?.data) {
            const base64Data = `data:${base64Images[key].contentType || 'image/jpeg'};base64,${base64Images[key].data}`;
            const added = addBase64ImageToPdf(base64Data, label);
            if (added) imageDisplayed = true;
          }
        }
        
        // Add first image from each array
        const arrayImages = [
          { key: 'sealingImages', label: 'Sealing Image' },
          { key: 'vehicleImages', label: 'Vehicle Image' },
          { key: 'additionalImages', label: 'Additional Image' }
        ];
        
        for (const { key, label } of arrayImages) {
          if (Array.isArray(base64Images[key]) && base64Images[key].length > 0) {
            // Add all images from the array
            base64Images[key].forEach((img, index) => {
              if (img?.data) {
                const base64Data = `data:${img.contentType || 'image/jpeg'};base64,${img.data}`;
                const indexLabel = `${label} ${index + 1}`;
                const added = addBase64ImageToPdf(base64Data, indexLabel);
                if (added) imageDisplayed = true;
              }
            });
          }
        }
      }
      
      // If no direct base64 data, try to fetch images from URLs
      if (!imageDisplayed && imageInfo && Object.keys(imageInfo).length > 0) {
        console.log(`Attempting to add images from URLs. Available image keys:`, Object.keys(imageInfo).join(', '));
        
        // Try to add standard single images first
        const singleImages = [
          { key: 'driverPicture', label: 'Driver Picture' },
          { key: 'vehicleNumberPlatePicture', label: 'Vehicle Plate' },
          { key: 'gpsImeiPicture', label: 'GPS/IMEI Picture' }
        ];
        
        // Process each single image
        for (const { key, label } of singleImages) {
          if (imageInfo[key]) {
            try {
              console.log(`Processing ${key} URL: ${imageInfo[key]}`);
              const imageData = await fetchImageData(imageInfo[key]);
              if (imageData) {
                const added = addBase64ImageToPdf(imageData, label);
                console.log(`${key} image ${added ? 'successfully added' : 'failed to add'}`);
                if (added) imageDisplayed = true;
              } else {
                console.log(`No image data returned for ${key}`);
              }
            } catch (error) {
              console.error(`Error processing ${key} image:`, error);
            }
          }
        }
        
        // Try to add ALL images from each image array
        const arrayImages = [
          { key: 'sealingImages', label: 'Sealing Image' },
          { key: 'vehicleImages', label: 'Vehicle Image' },
          { key: 'additionalImages', label: 'Additional Image' }
        ];
        
        // Process each array type
        for (const { key, label } of arrayImages) {
          if (Array.isArray(imageInfo[key]) && imageInfo[key].length > 0) {
            console.log(`Processing ${key} array with ${imageInfo[key].length} images`);
            // Process all images in the array
            for (let i = 0; i < imageInfo[key].length; i++) {
              try {
                if (!imageInfo[key][i]) continue;
                
                const indexLabel = `${label} ${i + 1}`;
                console.log(`Processing ${key}[${i}] URL: ${imageInfo[key][i]}`);
                
                const imageData = await fetchImageData(imageInfo[key][i]);
                if (imageData) {
                  const added = addBase64ImageToPdf(imageData, indexLabel);
                  console.log(`${key}[${i}] image ${added ? 'successfully added' : 'failed to add'}`);
                  if (added) imageDisplayed = true;
                } else {
                  console.log(`No image data returned for ${key}[${i}]`);
                }
              } catch (error) {
                console.error(`Error processing ${key}[${i}] image:`, error);
              }
            }
          }
        }
      }
      
      // Fallback if no images were displayed
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
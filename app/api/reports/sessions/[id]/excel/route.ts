import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";
import * as ExcelJS from 'exceljs';

interface TripDetails {
  transporterName: string;
  materialName: string;
  vehicleNumber: string;
  gpsImeiNumber: string;
  driverName: string;
  driverContactNumber: string;
  loaderName: string;
  loaderMobileNumber: string;
  challanRoyaltyNumber: string;
  doNumber: string;
  tpNumber: string;
  qualityOfMaterials: string;
  freight: number;
  grossWeight: number;
  tareWeight: number;
  netMaterialWeight: number;
  loadingSite: string;
  receiverPartyName: string;
}

interface ActivityLogDetails {
  tripDetails?: TripDetails;
  [key: string]: unknown;
}

// Generate Excel report for session
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
      
      console.log(`[EXCEL REPORT] Starting report generation for session ${sessionId}`);
      
      // Basic authorization check
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
      
      // Create a new workbook
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'CBUMS System';
      workbook.created = new Date();
      
      // =========================================================
      // 1. CREATE BASIC SESSION INFO SHEET
      // =========================================================
      console.log(`[EXCEL REPORT] Creating basic session info sheet`);
      
      const sessionData = await prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          createdBy: { select: { name: true, email: true } },
          company: { select: { name: true } },
          seal: true,
        },
      });
      
      if (!sessionData) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }
      
      // Fetch more detailed session data
      console.log(`[EXCEL REPORT] Fetching detailed session data`);
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
      
      // Debug: Log the full session data structure
      console.log(`[EXCEL REPORT] Session Data Structure:`, JSON.stringify({
        hasDetails: !!detailedSessionData,
        hasTripDetails: !!detailedSessionData.tripDetails,
        directTripDetails: directTripDetails,
        dataKeys: Object.keys(detailedSessionData || {}),
        rawTripDetails: detailedSessionData.tripDetails
      }));
      
      // Enhanced check for trip data in session.data field
      let dataFieldTripDetails: Record<string, any> = {};
      try {
        // The session.data field might contain trip details but in a different structure
        if (detailedSessionData.data) {
          console.log(`[EXCEL REPORT] Session has data field, checking for trip details`);
          
          let dataField = detailedSessionData.data;
          if (typeof dataField === 'string') {
            try {
              dataField = JSON.parse(dataField);
              console.log(`[EXCEL REPORT] Successfully parsed session.data as JSON`);
            } catch (e) {
              console.log(`[EXCEL REPORT] Failed to parse session.data as JSON: ${e}`);
            }
          }
          
          if (dataField && typeof dataField === 'object') {
            // Check for trip details object
            if (dataField.tripDetails && typeof dataField.tripDetails === 'object') {
              console.log(`[EXCEL REPORT] Found tripDetails in session.data.tripDetails`);
              dataFieldTripDetails = dataField.tripDetails;
            }
            // Check for trip-like fields directly in the data object
            else {
              const tripFieldKeys = Object.keys(dataField).filter(key => 
                tripDataFieldNames.includes(key) || 
                key.includes('driver') || 
                key.includes('vehicle') || 
                key.includes('material') ||
                key.includes('weight') ||
                key.includes('transporter')
              );
              
              if (tripFieldKeys.length > 0) {
                console.log(`[EXCEL REPORT] Found ${tripFieldKeys.length} trip-like fields in session.data`);
                for (const key of tripFieldKeys) {
                  dataFieldTripDetails[key] = dataField[key];
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`[EXCEL REPORT] Error extracting from session.data:`, error);
      }
      
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
      
      // Get image information
      let images = sessionData.images || {};
      console.log(`[EXCEL REPORT] Found ${Object.keys(images).length} image keys in session data`);
      
      // Fallback 1: Check activity logs for image URLs
      if (Object.keys(images).length === 0) {
        console.log(`[EXCEL REPORT] Checking activity logs for image URLs`);
        
        const activityLogs = await prisma.activityLog.findMany({
          where: {
            targetResourceId: sessionId,
            targetResourceType: 'session',
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
        
        // Look for image URLs in activity logs
        for (const log of activityLogs) {
          if (!log.details) continue;
          
          let details = log.details as any;
          if (typeof details === 'string') {
            try { details = JSON.parse(details); } catch (e) { continue; }
          }
          
          if (details.images && Object.keys(details.images).length > 0) {
            images = details.images;
            console.log(`[EXCEL REPORT] Found ${Object.keys(images).length} image references in activity log`);
            break;
          } else if (details.tripDetails?.images && Object.keys(details.tripDetails.images).length > 0) {
            images = details.tripDetails.images;
            console.log(`[EXCEL REPORT] Found ${Object.keys(images).length} image references in trip details`);
            break;
          }
        }
      }
      
      // Fallback 2: Generate direct API URLs
      if (Object.keys(images).length === 0) {
        console.log(`[EXCEL REPORT] Generating fallback API image URLs`);
        const domain = 'https://tripchallan.vercel.app';
        
        // Generate direct URLs using the domain
        images = {
          driverPicture: `${domain}/api/images/${sessionId}/driver`,
          vehicleNumberPlatePicture: `${domain}/api/images/${sessionId}/vehicleNumber`,
          gpsImeiPicture: `${domain}/api/images/${sessionId}/gpsImei`,
          sealingImages: [],
          vehicleImages: [],
          additionalImages: []
        };
        
        // Add multiple potential indices for array-based images
        // These might not all exist, but they'll be helpful references in the Excel report
        for (let i = 0; i < 5; i++) {
          (images.sealingImages as string[]).push(`${domain}/api/images/${sessionId}/sealing/${i}`);
          (images.vehicleImages as string[]).push(`${domain}/api/images/${sessionId}/vehicle/${i}`);
          (images.additionalImages as string[]).push(`${domain}/api/images/${sessionId}/additional/${i}`);
        }
        
        console.log(`[EXCEL REPORT] Generated fallback image URLs for session ${sessionId}`);
      }
      
      // COMPANY user check - can only download their own sessions
      if (userRole === UserRole.COMPANY && userId !== sessionData.companyId) {
        return NextResponse.json(
          { error: "Unauthorized - You can only download reports for your own sessions" },
          { status: 403 }
        );
      }
      
      // Create basic info sheet
      const basicSheet = workbook.addWorksheet('Session Info');
      basicSheet.columns = [
        { header: 'Property', key: 'property', width: 30 },
        { header: 'Value', key: 'value', width: 50 }
      ];
      
      // Style header row with CBUMS branding color
      basicSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      basicSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2962FF' } // CBUMS blue
      };
      
      // Add title and branding
      basicSheet.mergeCells('A1:B1');
      basicSheet.getCell('A1').value = 'SESSION REPORT';
      basicSheet.getCell('A1').alignment = { horizontal: 'center' };
      
      // Add report generation info
      basicSheet.mergeCells('A2:B2');
      basicSheet.getCell('A2').value = 'CBUMS - Consignment & Barcode Utilization Management System';
      basicSheet.getCell('A2').alignment = { horizontal: 'center' };
      basicSheet.getCell('A2').font = { bold: true, italic: true };
      
      // Add section header
      let rowIndex = 3;
      basicSheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
      basicSheet.getCell(`A${rowIndex}`).value = 'SESSION INFORMATION';
      basicSheet.getCell(`A${rowIndex}`).font = { bold: true, size: 14 };
      basicSheet.getCell(`A${rowIndex}`).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6E6' }
      };
      rowIndex++;
      
      // Add basic session data with alternating row colors
      const addBasicInfoRow = (property: string, value: any) => {
        const row = basicSheet.addRow({ property, value: value !== undefined && value !== null ? value : 'N/A' });
        
        // Add subtle alternating row colors
        if (rowIndex % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9F9F9' }
          };
        }
        
        // Make property column bold
        row.getCell(1).font = { bold: true };
        
        rowIndex++;
        return row;
      };
      
      addBasicInfoRow('Session ID', sessionData.id);
      addBasicInfoRow('Status', sessionData.status);
      addBasicInfoRow('Created At', new Date(sessionData.createdAt).toLocaleString());
      addBasicInfoRow('Source', sessionData.source);
      addBasicInfoRow('Destination', sessionData.destination);
      addBasicInfoRow('Company', sessionData.company.name);
      addBasicInfoRow('Created By', `${sessionData.createdBy.name} (${sessionData.createdBy.email})`);
      
      // Add seal info if available
      if (sessionData.seal) {
        // Add section header
        rowIndex++;
        basicSheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
        basicSheet.getCell(`A${rowIndex}`).value = 'SEAL INFORMATION';
        basicSheet.getCell(`A${rowIndex}`).font = { bold: true, size: 14 };
        basicSheet.getCell(`A${rowIndex}`).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE6E6E6' }
        };
        rowIndex++;
        
        addBasicInfoRow('Seal Barcode', sessionData.seal.barcode);
        addBasicInfoRow('Seal Status', sessionData.seal.verified ? 'Verified' : 'Not Verified');
      }
      
      // =========================================================
      // 2. CREATE TRIP DETAILS SHEET - CRITICAL!
      // =========================================================
      console.log(`[EXCEL REPORT] Creating trip details sheet - CRITICAL`);
      
      // Try to get trip details from activity log
      let tripDetails = null;
      try {
        console.log(`[EXCEL REPORT] Looking for trip details in activity logs`);
        
        const activityLogs = await prisma.activityLog.findMany({
          where: {
            targetResourceId: sessionId,
            targetResourceType: 'session',
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
        
        console.log(`[EXCEL REPORT] Found ${activityLogs.length} activity logs to search for trip details`);
        
        // Search through all logs for trip details
        for (const log of activityLogs) {
          if (!log.details) continue;
          
          try {
            let details = log.details;
            // Parse details if it's a string
            if (typeof details === 'string') {
              try { details = JSON.parse(details); } 
              catch (e) { 
                console.log(`[EXCEL REPORT] Failed to parse activity log details: ${e}`);
                continue; 
              }
            }
            
            // Check various locations where trip details might be stored
            if (details.tripDetails && typeof details.tripDetails === 'object') {
              console.log(`[EXCEL REPORT] Found tripDetails in activity log (direct)`);
              tripDetails = details.tripDetails;
              break;
            } else if (details.data?.tripDetails && typeof details.data.tripDetails === 'object') {
              console.log(`[EXCEL REPORT] Found tripDetails in activity log (data object)`);
              tripDetails = details.data.tripDetails;
              break;
            } else if (details.details?.tripDetails && typeof details.details.tripDetails === 'object') {
              console.log(`[EXCEL REPORT] Found tripDetails in activity log (nested details)`);
              tripDetails = details.details.tripDetails;
              break;
            }
          } catch (parseError) {
            console.error(`[EXCEL REPORT] Error processing activity log:`, parseError);
          }
        }
        
        // Last resort: scan all logs for any fields matching trip details pattern
        if (!tripDetails) {
          console.log(`[EXCEL REPORT] No trip details structure found, scanning all logs for field matches`);
          
          const tripFieldsMap: Record<string, any> = {};
          
          for (const log of activityLogs) {
            if (!log.details) continue;
            
            try {
              let details = log.details;
              if (typeof details === 'string') {
                try { details = JSON.parse(details); } 
                catch (e) { continue; }
              }
              
              // Function to scan an object for trip fields
              const scanForTripFields = (obj: any, path: string = '') => {
                if (!obj || typeof obj !== 'object') return;
                
                for (const [key, value] of Object.entries(obj)) {
                  const fullPath = path ? `${path}.${key}` : key;
                  
                  // Check if this is a trip field
                  if (tripDataFieldNames.includes(key) && value !== undefined && value !== null) {
                    console.log(`[EXCEL REPORT] Found trip field ${key} = ${value} at path ${fullPath}`);
                    tripFieldsMap[key] = value;
                  }
                  
                  // Recursively scan nested objects, but not arrays (to avoid excessive recursion)
                  if (value && typeof value === 'object' && !Array.isArray(value)) {
                    scanForTripFields(value, fullPath);
                  }
                }
              };
              
              // Scan the entire details object
              scanForTripFields(details);
              
            } catch (error) {
              console.error(`[EXCEL REPORT] Error scanning activity log:`, error);
            }
          }
          
          // If we found fields, create a trip details object
          if (Object.keys(tripFieldsMap).length > 0) {
            console.log(`[EXCEL REPORT] Created trip details from ${Object.keys(tripFieldsMap).length} scattered fields`);
            tripDetails = tripFieldsMap;
          }
        }
      } catch (error: unknown) {
        console.error(`[EXCEL REPORT] Error getting trip details:`, error);
      }
      
      // GUARANTEED SAMPLE DATA - Will always be included if no trip details found
      const SAMPLE_TRIP_DETAILS: TripDetails = {
        transporterName: "SAMPLE TRANSPORTER",
        materialName: "SAMPLE MATERIAL",
        vehicleNumber: "SAMPLE-123456",
        gpsImeiNumber: "123456789012345",
        driverName: "SAMPLE DRIVER",
        driverContactNumber: "1234567890",
        loaderName: "SAMPLE LOADER",
        loaderMobileNumber: "0987654321",
        challanRoyaltyNumber: "SAMPLE-CR-12345",
        doNumber: "SAMPLE-DO-67890",
        tpNumber: "SAMPLE-TP-54321",
        qualityOfMaterials: "SAMPLE QUALITY",
        freight: 5000,
        grossWeight: 10000,
        tareWeight: 3000,
        netMaterialWeight: 7000,
        loadingSite: "SAMPLE LOADING SITE",
        receiverPartyName: "SAMPLE RECEIVER"
      };
      
      // Use the real trip details from both sources, use sample only if nothing available
      let combinedTripDetails = { ...directTripDetails, ...dataFieldTripDetails, ...otherPossibleTripFields };
      if (tripDetails && Object.keys(tripDetails).length > 0) {
        combinedTripDetails = { ...combinedTripDetails, ...tripDetails };
      }
      
      // Log the final combined details 
      console.log(`[EXCEL REPORT] Final Combined Trip Details:`, 
        Object.keys(combinedTripDetails).length, 
        JSON.stringify(combinedTripDetails)
      );
      
      // Only use sample data if no real data is available
      const finalTripDetails = Object.keys(combinedTripDetails).length > 0 
        ? combinedTripDetails 
        : SAMPLE_TRIP_DETAILS;
      
      // Create trip details sheet with improved styling
      const tripDetailsSheet = workbook.addWorksheet('Trip Details');
      
      // Add a very prominent header
      tripDetailsSheet.mergeCells('A1:C1');
      const headerCell = tripDetailsSheet.getCell('A1');
      headerCell.value = 'TRIP DETAILS';
      headerCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      headerCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2962FF' } // CBUMS blue
      };
      headerCell.alignment = { horizontal: 'center' };
      
      // Add data source info
      tripDetailsSheet.mergeCells('A2:C2');
      const sourceCell = tripDetailsSheet.getCell('A2');
      sourceCell.value = `Data Source: ${Object.keys(combinedTripDetails).length > 0 ? 'Database' : 'SAMPLE (Due to missing data)'}`;
      sourceCell.font = { italic: true };
      
      // Add column headers in row 3
      tripDetailsSheet.columns = [
        { header: 'Field Name', key: 'field', width: 30 },
        { header: 'Value', key: 'value', width: 40 },
        { header: 'Source', key: 'source', width: 20 }
      ];
      
      // Style the column header row
      const headerRow = tripDetailsSheet.getRow(3);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2962FF' } // CBUMS blue
      };
      
      // Add each trip detail field to the sheet
      console.log(`[EXCEL REPORT] Adding trip details fields to Excel`);
      let tripRowIndex = 4;
      
      // Debug log the available trip fields
      console.log(`[EXCEL REPORT] finalTripDetails keys: ${Object.keys(finalTripDetails).join(', ')}`)

      // Define ordered fields for display - matching the PDF report order
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
      
      // Function to safely stringify any value type
      const safeStringify = (value: any): string => {
        if (value === undefined || value === null) return 'N/A';
        if (typeof value === 'object') {
          try {
            return JSON.stringify(value);
          } catch (e) {
            return String(value);
          }
        }
        return String(value);
      };
      
      // Helper to add a row with proper styling
      const addTripDetailRow = (fieldLabel: string, value: any, source: string) => {
        const row = tripDetailsSheet.addRow({
          field: fieldLabel,
          value: safeStringify(value),
          source: source
        });
        
        // Add subtle alternating row colors
        if (tripRowIndex % 2 === 0) {
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFF9F9F9' }
          };
        }
        
        // Make the field column bold
        row.getCell(1).font = { bold: true };
        
        tripRowIndex++;
        return row;
      };
      
      // First display ordered fields
      for (const field of orderedFields) {
        if (field in finalTripDetails && finalTripDetails[field] !== undefined) {
          // Format field name for display
          const formattedField = field.replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
          
          addTripDetailRow(formattedField, finalTripDetails[field], 'Trip Details');
        }
      }
      
      // Then display any other fields not in the ordered list
      for (const field of Object.keys(finalTripDetails)) {
        if (!orderedFields.includes(field) && finalTripDetails[field] !== undefined) {
          // Format field name for display
          const formattedField = field.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
          addTripDetailRow(formattedField, finalTripDetails[field], 'Trip Details');
        }
      }
      
      // If no trip details were added
      if (tripRowIndex === 4) {
        tripDetailsSheet.addRow(['No trip details available', '', '']);
      }
      
      // =========================================================
      // 3. CREATE IMAGE INFORMATION SHEET
      // =========================================================
      
      if (images && Object.keys(images).length > 0) {
        console.log(`[EXCEL REPORT] Creating image information sheet`);
        
        const imageSheet = workbook.addWorksheet('Images Information');
        
        // Add a very prominent header
        imageSheet.mergeCells('A1:E1');
        const headerCell = imageSheet.getCell('A1');
        headerCell.value = 'IMAGES INFORMATION';
        headerCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
        headerCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2962FF' } // CBUMS blue
        };
        headerCell.alignment = { horizontal: 'center' };
        
        imageSheet.columns = [
          { header: 'Image Type', key: 'type', width: 25 },
          { header: 'Description', key: 'description', width: 30 },
          { header: 'Status', key: 'status', width: 15 },
          { header: 'Count', key: 'count', width: 10 },
          { header: 'Direct URL', key: 'url', width: 80 }
        ];
        
        // Style header row
        const imageHeader = imageSheet.getRow(2);
        imageHeader.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        imageHeader.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF2962FF' } // CBUMS blue
        };
        
        // Format URLs for better display
        const formatImageUrl = (url: string) => {
          const domain = 'https://tripchallan.vercel.app';
          
          // If URL is already formatted correctly, return as is
          if (url && url.includes('http')) {
            return url;
          }
          
          // If it's a relative URL starting with /api/images, prepend domain
          if (url && url.startsWith('/api/images')) {
            return `${domain}${url}`;
          }
          
          // If it's just a path segment, construct a standard API URL
          if (url && !url.startsWith('/')) {
            return `${domain}/api/images/${sessionId}/${url}`;
          }
          
          return url || 'N/A';
        };
        
        // Helper to add single image row
        const addSingleImage = (type: string, key: string, description: string) => {
          const url = images[key] || null;
          const status = url ? 'Available' : 'Not Available';
          
          imageSheet.addRow({
            type,
            description,
            status,
            count: url ? 1 : 0,
            url: url ? formatImageUrl(url) : 'N/A'
          });
        };
        
        // Helper to add array images
        const addArrayImages = (type: string, key: string, description: string) => {
          const imageArray = images[key] || [];
          const count = Array.isArray(imageArray) ? imageArray.length : 0;
          const status = count > 0 ? 'Available' : 'Not Available';
          
          if (count === 0) {
            imageSheet.addRow({
              type,
              description,
              status: 'Not Available',
              count: 0,
              url: 'N/A'
            });
          } else {
            // Add a summary row first
            imageSheet.addRow({
              type,
              description: `${description} (${count} available)`,
              status,
              count,
              url: 'See individual entries below'
            });
            
            // Add each image in the array
            if (Array.isArray(imageArray)) {
              imageArray.forEach((url, index) => {
                imageSheet.addRow({
                  type: '',
                  description: `${description} ${index + 1}`,
                  status: 'Available',
                  count: '',
                  url: formatImageUrl(url)
                });
              });
            }
          }
        };
        
        // Process image data - match the same order as PDF
        // Single images
        addSingleImage('Driver', 'driverPicture', 'Driver Picture');
        addSingleImage('Vehicle', 'vehicleNumberPlatePicture', 'Vehicle Number Plate Picture');
        addSingleImage('GPS/IMEI', 'gpsImeiPicture', 'GPS or IMEI Picture');
        
        // Array images - matching PDF order
        addArrayImages('Sealing', 'sealingImages', 'Sealing Image');
        addArrayImages('Vehicle', 'vehicleImages', 'Vehicle Image');
        addArrayImages('Additional', 'additionalImages', 'Additional Image');
        
        // If there are no images of any kind, add an informational row
        if (Object.keys(images).length === 0 || (
            !images.driverPicture && 
            !images.vehicleNumberPlatePicture && 
            !images.gpsImeiPicture && 
            (!images.sealingImages || images.sealingImages.length === 0) &&
            (!images.vehicleImages || images.vehicleImages.length === 0) &&
            (!images.additionalImages || images.additionalImages.length === 0)
        )) {
          imageSheet.addRow({
            type: 'No Images',
            description: 'No images are available for this session',
            status: 'N/A',
            count: 0,
            url: 'N/A'
          });
        }
      }
      
      // =========================================================
      // 4. ADD VERIFICATION DATA IF AVAILABLE
      // =========================================================
      
      // Check for verification data
      try {
        const verificationLogs = await prisma.activityLog.findMany({
          where: {
            targetResourceId: sessionId,
            targetResourceType: 'session',
            action: 'UPDATE',
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
        
        // Look for verification data in logs
        let verificationData = null;
        for (const log of verificationLogs) {
          if (log.details && typeof log.details === 'object') {
            const details = log.details as any;
            if (details.verification) {
              verificationData = details.verification;
              break;
            }
          }
        }
        
        // If verification data exists, create a sheet for it
        if (verificationData && verificationData.fieldVerifications) {
          console.log(`[EXCEL REPORT] Adding verification data`);
          
          const verificationSheet = workbook.addWorksheet('Verification');
          
          verificationSheet.columns = [
            { header: 'Field', key: 'field', width: 30 },
            { header: 'Operator Value', key: 'operatorValue', width: 25 },
            { header: 'Guard Value', key: 'guardValue', width: 25 },
            { header: 'Match', key: 'match', width: 10 },
            { header: 'Comment', key: 'comment', width: 30 }
          ];
          
          // Style header row
          const verificationHeader = verificationSheet.getRow(1);
          verificationHeader.font = { bold: true };
          verificationHeader.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
          };
          
          // Add overall status
          verificationSheet.addRow({
            field: 'OVERALL STATUS',
            operatorValue: '',
            guardValue: '',
            match: verificationData.allMatch ? 'YES' : 'NO',
            comment: verificationData.allMatch ? 'All fields match' : 'Some fields do not match'
          });
          
          // Add verification for each field
          Object.entries(verificationData.fieldVerifications).forEach(([field, data]) => {
            const fieldData = data as any;
            const formattedField = field.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            const isMatch = fieldData.operatorValue === fieldData.guardValue;
            
            const row = verificationSheet.addRow({
              field: formattedField,
              operatorValue: fieldData.operatorValue,
              guardValue: fieldData.guardValue,
              match: isMatch ? 'YES' : 'NO',
              comment: fieldData.comment || ''
            });
            
            // Color the match cell based on match status
            const matchCell = row.getCell('match');
            matchCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: isMatch ? 'FF92D050' : 'FFFF0000' }  // Green or Red
            };
            matchCell.font.color = { argb: 'FFFFFFFF' };
          });
        }
      } catch (error) {
        console.error(`[EXCEL REPORT] Error adding verification data:`, error);
      }
      
      // =========================================================
      // 5. CREATE VERIFICATION INFO SHEET
      // =========================================================
      console.log(`[EXCEL REPORT] Creating verification information sheet`);
      
      const verificationSheet = workbook.addWorksheet('Verification Information');
      
      // Add a very prominent header
      verificationSheet.mergeCells('A1:D1');
      const verHeaderCell = verificationSheet.getCell('A1');
      verHeaderCell.value = 'VERIFICATION INFORMATION';
      verHeaderCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      verHeaderCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2962FF' } // CBUMS blue
      };
      verHeaderCell.alignment = { horizontal: 'center' };
      
      // Set up columns
      verificationSheet.columns = [
        { header: 'Field', key: 'field', width: 30 },
        { header: 'Operator Value', key: 'operatorValue', width: 30 },
        { header: 'Guard Value', key: 'guardValue', width: 30 },
        { header: 'Match Status', key: 'matchStatus', width: 15 }
      ];
      
      // Style header row
      const verHeaderRow = verificationSheet.getRow(2);
      verHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      verHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2962FF' } // CBUMS blue
      };
      
      // Add basic seal verification info
      let verRowIndex = 3;
      verificationSheet.addRow({
        field: 'Seal Barcode',
        operatorValue: sessionData.seal?.barcode || 'N/A',
        guardValue: 'N/A',
        matchStatus: 'N/A'
      });
      
      verificationSheet.addRow({
        field: 'Verification Status',
        operatorValue: sessionData.seal?.verified ? 'Verified' : 'Not Verified',
        guardValue: 'N/A',
        matchStatus: 'N/A'
      });
      
      if (sessionData.seal?.verified && sessionData.seal.verifiedBy) {
        verificationSheet.addRow({
          field: 'Verified By',
          operatorValue: sessionData.seal.verifiedBy.name || 'N/A',
          guardValue: 'N/A',
          matchStatus: 'N/A'
        });
        
        if (sessionData.seal.scannedAt) {
          verificationSheet.addRow({
            field: 'Verified At',
            operatorValue: new Date(sessionData.seal.scannedAt).toLocaleString(),
            guardValue: 'N/A',
            matchStatus: 'N/A'
          });
        }
      }
      
      // Check for verification details in activity logs
      const verificationLogs = await prisma.activityLog.findMany({
        where: {
          targetResourceId: sessionId,
          targetResourceType: 'session',
          action: 'verify_seal'
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 1
      });
      
      // Add field verification details if available
      if (verificationLogs.length > 0 && verificationLogs[0].details) {
        // Add separator row
        verificationSheet.addRow({});
        const separatorRow = verificationSheet.getRow(++verRowIndex);
        separatorRow.getCell(1).value = 'FIELD VERIFICATION DETAILS';
        separatorRow.getCell(1).font = { bold: true };
        separatorRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        verRowIndex++;
        
        let details = verificationLogs[0].details;
        if (typeof details === 'string') {
          try {
            details = JSON.parse(details);
          } catch (e) {
            console.error(`[EXCEL REPORT] Error parsing verification details`, e);
          }
        }
        
        if (details?.verificationData?.fieldVerifications) {
          const fieldVerifications = details.verificationData.fieldVerifications;
          
          for (const [field, fieldData] of Object.entries(fieldVerifications)) {
            // Type assertion to ensure TS knows the structure
            const data = fieldData as {
              operatorValue: string | number;
              guardValue: string | number;
              matches: boolean;
              comment?: string;
            };
            
            // Format field name for display
            const formattedField = field.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            // Determine match status
            let matchStatus = 'Unknown';
            if (data.matches === true) {
              matchStatus = 'Matched ✓';
            } else if (data.matches === false) {
              matchStatus = 'Mismatched ✗';
            }
            
            // Add row
            const row = verificationSheet.addRow({
              field: formattedField,
              operatorValue: safeStringify(data.operatorValue),
              guardValue: safeStringify(data.guardValue),
              matchStatus: matchStatus
            });
            
            // Color code match status
            const cell = row.getCell(4);
            if (matchStatus === 'Matched ✓') {
              cell.font = { color: { argb: 'FF008000' } }; // Green
            } else if (matchStatus === 'Mismatched ✗') {
              cell.font = { color: { argb: 'FFFF0000' } }; // Red
            }
            
            verRowIndex++;
          }
          
          // Add overall match status
          verificationSheet.addRow({});
          const overallRow = verificationSheet.addRow({
            field: 'Overall Match Status',
            operatorValue: '',
            guardValue: '',
            matchStatus: details.verificationData.allMatch ? 'All Fields Match ✓' : 'Some Fields Mismatch ✗'
          });
          
          // Style the overall row
          overallRow.font = { bold: true };
          const overallCell = overallRow.getCell(4);
          if (details.verificationData.allMatch) {
            overallCell.font = { bold: true, color: { argb: 'FF008000' } }; // Green
          } else {
            overallCell.font = { bold: true, color: { argb: 'FFFF0000' } }; // Red
          }
        } else {
          verificationSheet.addRow({
            field: 'No Field Verification Data',
            operatorValue: '',
            guardValue: '',
            matchStatus: ''
          });
        }
      } else if (!sessionData.seal?.verified) {
        // Add message if not verified
        verificationSheet.addRow({});
        verificationSheet.addRow({
          field: 'Status',
          operatorValue: 'This session has not been verified yet',
          guardValue: '',
          matchStatus: ''
        });
      }
      
      // =========================================================
      // 6. GENERATE AND RETURN THE EXCEL FILE
      // =========================================================
      
      console.log(`[EXCEL REPORT] Generating Excel buffer`);
      const buffer = await workbook.xlsx.writeBuffer();
      
      console.log(`[EXCEL REPORT] Returning Excel file`);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename=session-${sessionId}.xlsx`,
        },
      });
      
    } catch (error) {
      console.error("[EXCEL REPORT] Error generating report:", error);
      return NextResponse.json(
        { error: "Failed to generate Excel report", details: error instanceof Error ? error.message : String(error) },
        { status: 500 }
      );
    }
  },
  [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.COMPANY]
); 
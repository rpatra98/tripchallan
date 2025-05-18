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
      
      // Get all images
      const images = detailedSessionData.images || {};
      
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
        
        if (activityLog?.details) {
          const details = activityLog.details as ActivityLogDetails;
          if (details.tripDetails) {
            tripDetails = details.tripDetails;
            console.log(`[EXCEL REPORT] Found trip details in activity log`);
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
      let combinedTripDetails = { ...directTripDetails, ...otherPossibleTripFields };
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
      const tripSheet = workbook.addWorksheet('Trip Details');
      
      // Add a very prominent header
      tripSheet.mergeCells('A1:C1');
      const headerCell = tripSheet.getCell('A1');
      headerCell.value = 'TRIP DETAILS';
      headerCell.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
      headerCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2962FF' } // CBUMS blue
      };
      headerCell.alignment = { horizontal: 'center' };
      
      // Add data source info
      tripSheet.mergeCells('A2:C2');
      const sourceCell = tripSheet.getCell('A2');
      sourceCell.value = `Data Source: ${Object.keys(combinedTripDetails).length > 0 ? 'Database' : 'SAMPLE (Due to missing data)'}`;
      sourceCell.font = { italic: true };
      
      // Add column headers in row 3
      tripSheet.columns = [
        { header: 'Field Name', key: 'field', width: 30 },
        { header: 'Value', key: 'value', width: 40 },
        { header: 'Source', key: 'source', width: 20 }
      ];
      
      // Style the column header row
      const headerRow = tripSheet.getRow(3);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2962FF' } // CBUMS blue
      };
      
      // Define the standard trip detail fields
      const tripFields = [
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
      
      // Add each trip detail field to the sheet
      console.log(`[EXCEL REPORT] Adding trip details fields to Excel`);
      let tripRowIndex = 4;
      for (const field of tripFields) {
        const value = finalTripDetails[field.key as keyof TripDetails];
        const displayValue = value !== undefined && value !== null 
          ? String(value)
          : 'N/A';
        
        tripSheet.addRow({
          field: field.label,
          value: displayValue,
          source: Object.keys(combinedTripDetails).length > 0 ? 'Database' : 'Sample'
        });
        
        tripRowIndex++;
      }
      
      // Add any additional fields not in our standard list
      for (const [key, value] of Object.entries(finalTripDetails)) {
        // Skip fields we've already added
        if (tripFields.some(field => field.key === key)) {
          continue;
        }
        
        // Format key from camelCase to Title Case with spaces
        const formattedKey = key.replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());
        
        const displayValue = value !== undefined && value !== null 
          ? String(value)
          : 'N/A';
        
        tripSheet.addRow({
          field: formattedKey,
          value: displayValue,
          source: Object.keys(combinedTripDetails).length > 0 ? 'Database' : 'Sample'
        });
        
        tripRowIndex++;
      }
      
      // =========================================================
      // 3. CREATE IMAGE INFORMATION SHEET
      // =========================================================
      
      if (images && Object.keys(images).length > 0) {
        console.log(`[EXCEL REPORT] Creating image information sheet`);
        
        const imageSheet = workbook.addWorksheet('Images Information');
        
        imageSheet.columns = [
          { header: 'Image Type', key: 'type', width: 30 },
          { header: 'Status', key: 'status', width: 20 },
          { header: 'Count', key: 'count', width: 15 },
          { header: 'Notes', key: 'notes', width: 40 }
        ];
        
        // Style header row
        const imageHeader = imageSheet.getRow(1);
        imageHeader.font = { bold: true };
        imageHeader.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFD3D3D3' }
        };
        
        // Add image information
        if (images.driverPicture) {
          imageSheet.addRow({
            type: 'Driver Picture',
            status: 'Available',
            count: 1,
            notes: 'Uploaded during session creation'
          });
        }
        
        if (images.vehicleNumberPlatePicture) {
          imageSheet.addRow({
            type: 'Vehicle Number Plate Picture',
            status: 'Available',
            count: 1,
            notes: 'Uploaded during session creation'
          });
        }
        
        if (images.gpsImeiPicture) {
          imageSheet.addRow({
            type: 'GPS/IMEI Picture',
            status: 'Available',
            count: 1,
            notes: 'Uploaded during session creation'
          });
        }
        
        if (images.sealingImages && images.sealingImages.length > 0) {
          imageSheet.addRow({
            type: 'Sealing Images',
            status: 'Available',
            count: images.sealingImages.length,
            notes: 'Images related to seal application'
          });
        }
        
        if (images.vehicleImages && images.vehicleImages.length > 0) {
          imageSheet.addRow({
            type: 'Vehicle Images',
            status: 'Available',
            count: images.vehicleImages.length,
            notes: 'Images of the vehicle from various angles'
          });
        }
        
        if (images.additionalImages && images.additionalImages.length > 0) {
          imageSheet.addRow({
            type: 'Additional Images',
            status: 'Available',
            count: images.additionalImages.length,
            notes: 'Supplementary images uploaded by operator'
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
      // 5. GENERATE AND RETURN THE EXCEL FILE
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
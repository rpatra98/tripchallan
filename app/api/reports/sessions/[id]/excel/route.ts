import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { UserRole } from "@/lib/enums";
import * as ExcelJS from 'exceljs';

// Simplified Excel report generator that matches PDF output
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
      console.log(`[EXCEL REPORT] Starting simplified report generation for session ${sessionId}`);
      
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
      
      // ======== FETCH SESSION DATA ========
      const sessionData = await supabase.from('sessions').findUnique({
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
        },
      });

      if (!sessionData) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      // ======== EXTRACT TRIP DETAILS ========
      let tripDetails = sessionData.tripDetails || {};
      
      // Extract additional trip fields directly from session data if available
      const directFieldNames = [
        'vehicleNumber', 'driverName', 'driverContactNumber', 'freight', 
        'transporterName', 'materialName', 'gpsImeiNumber', 'challanRoyaltyNumber',
        'doNumber', 'tpNumber', 'grossWeight', 'tareWeight', 'loadingSite',
        'receiverPartyName', 'loaderName', 'loaderMobileNumber', 'qualityOfMaterials',
        'netMaterialWeight'
      ];
      
      for (const field of directFieldNames) {
        if (sessionData[field as keyof typeof sessionData] !== undefined && 
            sessionData[field as keyof typeof sessionData] !== null &&
            !tripDetails[field]) {
          tripDetails[field] = sessionData[field as keyof typeof sessionData];
        }
      }
      
      // Get activity logs for additional information
      let activityLogs = [];
      try {
        const { data: logs, error: logsError } = await supabase
          .from('activityLogs')
          .select('*')
          .eq('targetResourceId', sessionId)
          .eq('targetResourceType', 'session')
          .order('createdAt', { ascending: true });
        
        if (logsError) {
          console.error('Error fetching activity logs:', logsError);
        } else {
          activityLogs = logs || [];
        }
      } catch (error) {
        console.error("Error fetching activity logs:", error);
        // Continue without activity logs
      }
      
      // Extract trip details from activity logs
      for (const log of activityLogs) {
        if (!log.details) continue;
        
        let details: any;
        if (typeof log.details === 'string') {
          try {
            details = JSON.parse(log.details);
          } catch (e) {
            continue;
          }
        } else {
          details = log.details;
        }
        
        // Try different locations where trip details might be stored
        if (details.tripDetails && typeof details.tripDetails === 'object') {
          for (const [key, value] of Object.entries(details.tripDetails)) {
            if (value !== undefined && value !== null && !tripDetails[key]) {
              tripDetails[key] = value;
            }
          }
        }
        
        // Also check for image information
        if (details.images && Object.keys(details.images).length > 0 && !sessionData.images) {
          sessionData.images = details.images;
        }
      }
      
      // Extract image information
      let imageInfo = sessionData.images || {};
      
      // If no images found in session data, generate placeholder URLs
      if (Object.keys(imageInfo).length === 0) {
        const domain = 'https://tripchallan.vercel.app';
        imageInfo = {
          driverPicture: `${domain}/api/images/${sessionId}/driver`,
          vehicleNumberPlatePicture: `${domain}/api/images/${sessionId}/vehicleNumber`,
          gpsImeiPicture: `${domain}/api/images/${sessionId}/gpsImei`,
          sealingImages: [`${domain}/api/images/${sessionId}/sealing/0`],
          vehicleImages: [`${domain}/api/images/${sessionId}/vehicle/0`],
          additionalImages: []
        };
      }
      
      // ======== CREATE EXCEL WORKBOOK ========
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'CBUMS System';
      workbook.created = new Date();
      
      // Helper function to safely stringify values
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
      
      // Helper function to format camelCase to Title Case
      const formatFieldName = (field: string): string => {
        return field
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());
      };
      
      // ======== 1. SESSION INFO SHEET ========
      const basicSheet = workbook.addWorksheet('Session Info');
      
      // Set up columns
      basicSheet.columns = [
        { header: 'Field', key: 'field', width: 30 },
        { header: 'Value', key: 'value', width: 50 }
      ];
      
      // Add header styling
      basicSheet.mergeCells('A1:B1');
      const headerCell = basicSheet.getCell('A1');
      headerCell.value = 'SESSION INFORMATION';
      headerCell.font = { size: 16, bold: true };
      headerCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };
      headerCell.alignment = { horizontal: 'center' };
      
      // Style the header row
      const headerRow = basicSheet.getRow(2);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6E6' }
      };
      
      // Add session info rows
      let rowIndex = 3;
      basicSheet.addRow({ field: 'Session ID', value: sessionData.id });
      basicSheet.addRow({ field: 'Status', value: sessionData.status });
      basicSheet.addRow({ field: 'Created At', value: new Date(sessionData.createdAt).toLocaleString() });
      basicSheet.addRow({ field: 'Source', value: sessionData.source || 'N/A' });
      basicSheet.addRow({ field: 'Destination', value: sessionData.destination || 'N/A' });
      basicSheet.addRow({ field: 'Company', value: sessionData.company?.name || 'N/A' });
      basicSheet.addRow({ field: 'Created By', value: `${sessionData.createdBy?.name || 'N/A'} (${sessionData.createdBy?.email || 'N/A'})` });
      
      // ======== 2. SEAL INFORMATION ========
      basicSheet.addRow({});
      rowIndex = basicSheet.rowCount + 1;
      basicSheet.mergeCells(`A${rowIndex}:B${rowIndex}`);
      const sealHeaderCell = basicSheet.getCell(`A${rowIndex}`);
      sealHeaderCell.value = 'SEAL INFORMATION';
      sealHeaderCell.font = { size: 14, bold: true };
      sealHeaderCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };
      sealHeaderCell.alignment = { horizontal: 'center' };
      
      // Add seal info rows
      if (sessionData.seal) {
        basicSheet.addRow({ field: 'Seal Barcode', value: sessionData.seal.barcode || 'N/A' });
        basicSheet.addRow({ field: 'Seal Status', value: sessionData.seal.verified ? 'Verified' : 'Not Verified' });
        
        if (sessionData.seal.verified && sessionData.seal.verifiedBy) {
          basicSheet.addRow({ field: 'Verified By', value: sessionData.seal.verifiedBy.name || 'N/A' });
          if (sessionData.seal.scannedAt) {
            basicSheet.addRow({ field: 'Verified At', value: new Date(sessionData.seal.scannedAt).toLocaleString() });
          }
        }
      } else {
        basicSheet.addRow({ field: 'Seal Information', value: 'No seal information available' });
      }
      
      // ======== 3. TRIP DETAILS SHEET ========
      const tripSheet = workbook.addWorksheet('Trip Details');
      
      // Set up columns
      tripSheet.columns = [
        { header: 'Field', key: 'field', width: 30 },
        { header: 'Value', key: 'value', width: 50 }
      ];
      
      // Add header styling
      tripSheet.mergeCells('A1:B1');
      const tripHeaderCell = tripSheet.getCell('A1');
      tripHeaderCell.value = 'TRIP DETAILS';
      tripHeaderCell.font = { size: 16, bold: true };
      tripHeaderCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };
      tripHeaderCell.alignment = { horizontal: 'center' };
      
      // Style the header row
      const tripHeaderRow = tripSheet.getRow(2);
      tripHeaderRow.font = { bold: true };
      tripHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6E6' }
      };
      
      // Define ordered fields to match PDF report
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
      
      // First add ordered fields
      let tripRowIndex = 3;
      let tripFieldsAdded = false;
      
      for (const field of orderedFields) {
        if (field in tripDetails && tripDetails[field] !== undefined) {
          tripSheet.addRow({ field: formatFieldName(field), value: safeStringify(tripDetails[field]) });
          tripFieldsAdded = true;
        }
      }
      
      // Then add any remaining fields not in the ordered list
      for (const field in tripDetails) {
        if (!orderedFields.includes(field) && tripDetails[field] !== undefined) {
          tripSheet.addRow({ field: formatFieldName(field), value: safeStringify(tripDetails[field]) });
          tripFieldsAdded = true;
        }
      }
      
      // If no trip details added
      if (!tripFieldsAdded) {
        tripSheet.addRow({ field: 'No Trip Details', value: 'No trip details available for this session' });
      }
      
      // ======== 4. IMAGES INFORMATION SHEET ========
      const imageSheet = workbook.addWorksheet('Images Information');
      
      // Set up columns
      imageSheet.columns = [
        { header: 'Image Type', key: 'type', width: 30 },
        { header: 'Status', key: 'status', width: 20 },
        { header: 'URL', key: 'url', width: 80 }
      ];
      
      // Add header styling
      imageSheet.mergeCells('A1:C1');
      const imageHeaderCell = imageSheet.getCell('A1');
      imageHeaderCell.value = 'IMAGES INFORMATION';
      imageHeaderCell.font = { size: 16, bold: true };
      imageHeaderCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };
      imageHeaderCell.alignment = { horizontal: 'center' };
      
      // Style the header row
      const imageHeaderRow = imageSheet.getRow(2);
      imageHeaderRow.font = { bold: true };
      imageHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6E6' }
      };
      
      // Format image URL
      const formatImageUrl = (url: string): string => {
        if (!url) return 'N/A';
        
        const domain = 'https://tripchallan.vercel.app';
        
        // If URL is already absolute, return as is
        if (url.startsWith('http')) {
          return url;
        }
        
        // If URL is a relative path starting with /api/images
        if (url.startsWith('/api/images')) {
          return `${domain}${url}`;
        }
        
        // Construct URL for other cases
        return `${domain}/api/images/${sessionId}/${url}`;
      };
      
      // Add single images
      if (imageInfo.driverPicture) {
        imageSheet.addRow({
          type: 'Driver Picture',
          status: 'Available',
          url: formatImageUrl(imageInfo.driverPicture)
        });
      }
      
      if (imageInfo.vehicleNumberPlatePicture) {
        imageSheet.addRow({
          type: 'Vehicle Number Plate Picture',
          status: 'Available',
          url: formatImageUrl(imageInfo.vehicleNumberPlatePicture)
        });
      }
      
      if (imageInfo.gpsImeiPicture) {
        imageSheet.addRow({
          type: 'GPS/IMEI Picture',
          status: 'Available',
          url: formatImageUrl(imageInfo.gpsImeiPicture)
        });
      }
      
      // Add array images with a row for each image
      const addImageArray = (images: string[] | undefined, typeLabel: string) => {
        if (!images || !Array.isArray(images) || images.length === 0) {
          imageSheet.addRow({
            type: typeLabel,
            status: 'Not Available',
            url: 'N/A'
          });
          return;
        }
        
        // Add a summary row
        imageSheet.addRow({
          type: `${typeLabel} (${images.length} images)`,
          status: 'Available',
          url: 'See individual URLs below'
        });
        
        // Add individual image rows
        images.forEach((url, index) => {
          imageSheet.addRow({
            type: `${typeLabel} ${index + 1}`,
            status: 'Available',
            url: formatImageUrl(url)
          });
        });
      };
      
      // Add array-based images
      addImageArray(imageInfo.sealingImages as string[], 'Sealing Image');
      addImageArray(imageInfo.vehicleImages as string[], 'Vehicle Image');
      addImageArray(imageInfo.additionalImages as string[], 'Additional Image');
      
      // If no images added
      if (imageSheet.rowCount <= 2) {
        imageSheet.addRow({
          type: 'No Images',
          status: 'Not Available',
          url: 'No images available for this session'
        });
      }
      
      // ======== 5. VERIFICATION INFORMATION SHEET ========
      const verificationSheet = workbook.addWorksheet('Verification Information');
      
      // Set up columns
      verificationSheet.columns = [
        { header: 'Field', key: 'field', width: 30 },
        { header: 'Status', key: 'status', width: 50 }
      ];
      
      // Add header styling
      verificationSheet.mergeCells('A1:B1');
      const verHeaderCell = verificationSheet.getCell('A1');
      verHeaderCell.value = 'VERIFICATION INFORMATION';
      verHeaderCell.font = { size: 16, bold: true };
      verHeaderCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD3D3D3' }
      };
      verHeaderCell.alignment = { horizontal: 'center' };
      
      // Style the header row
      const verHeaderRow = verificationSheet.getRow(2);
      verHeaderRow.font = { bold: true };
      verHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE6E6E6' }
      };
      
      // Add seal verification info
      if (sessionData.seal) {
        verificationSheet.addRow({ 
          field: 'Seal Barcode', 
          status: sessionData.seal.barcode || 'N/A'
        });
        
        verificationSheet.addRow({ 
          field: 'Verification Status', 
          status: sessionData.seal.verified ? 'Verified' : 'Not Verified'
        });
        
        if (sessionData.seal.verified && sessionData.seal.verifiedBy) {
          verificationSheet.addRow({ 
            field: 'Verified By', 
            status: sessionData.seal.verifiedBy.name || 'N/A'
          });
          
          if (sessionData.seal.scannedAt) {
            verificationSheet.addRow({ 
              field: 'Verified At', 
              status: new Date(sessionData.seal.scannedAt).toLocaleString()
            });
          }
        }
      } else {
        verificationSheet.addRow({ 
          field: 'Seal Status', 
          status: 'No seal information available'
        });
      }
      
      // Add verification status message
      if (!sessionData.seal?.verified) {
        verificationSheet.addRow({});
        verificationSheet.addRow({ 
          field: 'Status', 
          status: 'This session has not been verified yet'
        });
      }
      
      // ======== GENERATE AND RETURN EXCEL FILE ========
      console.log(`[EXCEL REPORT] Generating Excel buffer`);
      const buffer = await workbook.xlsx.writeBuffer();
      
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
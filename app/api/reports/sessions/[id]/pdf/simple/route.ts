import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { withAuth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { UserRole } from "@/prisma/enums";

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
        'billingDetails', 'billing_details', 'paymentDetails', 'payment_details'
      ];
      
      // Check if any trip fields exist directly in the session object
      for (const field of tripDataFieldNames) {
        if (field in sessionData && sessionData[field as keyof typeof sessionData] !== undefined) {
          otherPossibleTripFields[field] = sessionData[field as keyof typeof sessionData];
        }
      }
      
      // Check for JSON data in the session object
      for (const [key, value] of Object.entries(sessionData)) {
        // Check if the field is a JSON string that we might need to parse
        if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
          try {
            const parsedValue = JSON.parse(value);
            // If it contains trip details, extract them
            if (parsedValue && typeof parsedValue === 'object') {
              for (const field of tripDataFieldNames) {
                if (field in parsedValue) {
                  otherPossibleTripFields[field] = parsedValue[field];
                }
              }
            }
          } catch (e) {
            // Not valid JSON, ignore
          }
        }
        
        // Check if the field is an object that might contain trip details
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          for (const field of tripDataFieldNames) {
            if (field in value) {
              otherPossibleTripFields[field] = (value as any)[field];
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
      
      // Title
      sections.push("============================================");
      sections.push("              SESSION REPORT               ");
      sections.push("============================================");
      sections.push("");
      
      // Session Information
      sections.push("SESSION INFORMATION");
      sections.push("-------------------");
      sections.push(`Session ID: ${sessionData.id}`);
      sections.push(`Status: ${sessionData.status}`);
      sections.push(`Created At: ${formatDate(sessionData.createdAt)}`);
      sections.push(`Source: ${sessionData.source || 'N/A'}`);
      sections.push(`Destination: ${sessionData.destination || 'N/A'}`);
      sections.push(`Company: ${sessionData.company?.name || 'N/A'}`);
      sections.push(`Created By: ${sessionData.createdBy?.name || 'N/A'} (${sessionData.createdBy?.email || 'N/A'})`);
      sections.push("");
      
      // Seal Information
      sections.push("SEAL INFORMATION");
      sections.push("----------------");
      if (sessionData.seal) {
        sections.push(`Barcode: ${sessionData.seal.barcode || 'N/A'}`);
        sections.push(`Status: ${sessionData.seal.verified ? 'Verified' : 'Not Verified'}`);
        if (sessionData.seal.verified && sessionData.seal.verifiedBy) {
          sections.push(`Verified By: ${sessionData.seal.verifiedBy.name || 'N/A'}`);
          if (sessionData.seal.scannedAt) {
            sections.push(`Verified At: ${formatDate(sessionData.seal.scannedAt)}`);
          }
        }
      } else {
        sections.push("No seal information available");
      }
      sections.push("");
      
      // Trip Details
      sections.push("TRIP DETAILS");
      sections.push("------------");
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
            sections.push(`${label}: ${value !== null && value !== undefined ? value : 'N/A'}`);
          }
        }
        
        // Then add any other fields that might exist
        for (const [key, value] of Object.entries(completeDetails)) {
          if (!(key in fieldLabels)) {
            // Format key from camelCase to Title Case with spaces
            const formattedKey = key.replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            sections.push(`${formattedKey}: ${value !== null && value !== undefined ? value : 'N/A'}`);
          }
        }
      } else {
        sections.push("No trip details available");
      }
      sections.push("");
      
      // Images Information
      sections.push("IMAGES INFORMATION");
      sections.push("------------------");
      
      if (images && Object.keys(images).length > 0) {
        if (images.driverPicture) {
          sections.push("Driver Picture: Available");
        }
        
        if (images.vehicleNumberPlatePicture) {
          sections.push("Vehicle Number Plate Picture: Available");
        }
        
        if (images.gpsImeiPicture) {
          sections.push("GPS/IMEI Picture: Available");
        }
        
        if (images.sealingImages && images.sealingImages.length > 0) {
          sections.push(`Sealing Images: ${images.sealingImages.length} available`);
        }
        
        if (images.vehicleImages && images.vehicleImages.length > 0) {
          sections.push(`Vehicle Images: ${images.vehicleImages.length} available`);
        }
        
        if (images.additionalImages && images.additionalImages.length > 0) {
          sections.push(`Additional Images: ${images.additionalImages.length} available`);
        }
      } else {
        sections.push("No images available");
      }
      sections.push("");
      
      // Verification Results
      sections.push("VERIFICATION RESULTS");
      sections.push("--------------------");
      const verificationDetails = verificationLogs.find((log: any) => 
        log.details && typeof log.details === 'object' && 'verification' in log.details
      );
      
      if (verificationDetails?.details) {
        const details = verificationDetails.details as unknown as { verification: VerificationDetails };
        const verification = details.verification;
        
        sections.push(`Overall Status: ${verification.allMatch ? 'All fields match' : 'Some fields do not match'}`);
        sections.push("");
        
        for (const [field, data] of Object.entries(verification.fieldVerifications)) {
          const formattedField = field.replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase());
          
          sections.push(`${formattedField}:`);
          sections.push(`  Operator Value: ${data.operatorValue}`);
          sections.push(`  Guard Value: ${data.guardValue}`);
          sections.push(`  Match: ${data.operatorValue === data.guardValue ? 'Yes' : 'No'}`);
          if (data.comment) {
            sections.push(`  Comment: ${data.comment}`);
          }
          sections.push("");
        }
      } else {
        sections.push("No verification data available");
      }
      sections.push("");
      
      // Comments
      sections.push("COMMENTS");
      sections.push("--------");
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
      
      // Join all sections with newlines
      const reportText = sections.join('\n');
      
      // Return the text report
      return new NextResponse(reportText, {
        headers: {
          'Content-Type': 'text/plain',
          'Content-Disposition': `attachment; filename="session-${sessionId}.txt"`,
        },
      });
      
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
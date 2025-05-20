const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function fetchPdfData(sessionId) {
  try {
    console.log(`Fetching PDF data for session ID: ${sessionId}`);
    
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
          take: 10,
        },
      },
    });

    if (!sessionData) {
      console.log('Session not found');
      return;
    }

    // Format date helper
    const formatDate = (date) => {
      try {
        return new Date(date).toLocaleString();
      } catch {
        return String(date);
      }
    };

    // Fetch activity logs
    // 1. Trip details log
    const tripLog = await prisma.activityLog.findFirst({
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

    // 2. Verification logs
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

    // Extract trip details
    let tripDetails = {};
    let images = {};

    if (tripLog?.details) {
      let details = tripLog.details;
      
      if (typeof details === 'string') {
        try {
          details = JSON.parse(details);
        } catch (e) {
          console.error("Failed to parse tripLog.details string:", e);
        }
      }
      
      // Extract trip details and images
      if (details.tripDetails) {
        tripDetails = details.tripDetails;
      }
      
      if (details.images) {
        images = details.images;
      }
    }

    // Collect all data for PDF
    const pdfData = {
      sessionInfo: {
        id: sessionData.id,
        source: sessionData.source,
        destination: sessionData.destination,
        status: sessionData.status,
        createdAt: formatDate(sessionData.createdAt),
        company: sessionData.company?.name || 'N/A',
        createdBy: `${sessionData.createdBy?.name || 'N/A'} (${sessionData.createdBy?.email || 'N/A'})`,
      },
      sealInfo: sessionData.seal ? {
        barcode: sessionData.seal.barcode || 'N/A',
        verified: sessionData.seal.verified ? 'Verified' : 'Not Verified',
        verifiedBy: sessionData.seal.verifiedBy?.name || 'N/A',
        verifiedAt: sessionData.seal.scannedAt ? formatDate(sessionData.seal.scannedAt) : 'N/A',
      } : null,
      tripDetails,
      imageInfo: images,
      verificationInfo: null,
    };

    // Check for verification info
    const verificationInfo = verificationLogs.find((log) => 
      log.details && typeof log.details === 'object' && 'verification' in log.details
    );

    if (verificationInfo?.details) {
      let details = verificationInfo.details;
      
      if (typeof details === 'string') {
        try {
          details = JSON.parse(details);
        } catch (e) {
          console.error("Failed to parse verification details:", e);
        }
      }
      
      if (details.verification) {
        pdfData.verificationInfo = details.verification;
      }
    }

    // Output data
    console.log('\n=== PDF DATA SUMMARY ===');
    console.log('Session Info:', pdfData.sessionInfo);
    console.log('Seal Info:', pdfData.sealInfo || 'None');
    
    console.log('\n--- TRIP DETAILS ---');
    if (Object.keys(pdfData.tripDetails).length > 0) {
      // Display the specific fields in the requested order
      const requestedFields = [
        'freight',
        'doNumber',
        'tpNumber',
        'driverName',
        'loaderName',
        'tareWeight',
        'grossWeight',
        'materialName',
        'gpsImeiNumber',
        'vehicleNumber',
        'transporterName',
        'receiverPartyName',
        'loaderMobileNumber',
        'qualityOfMaterials',
        'driverContactNumber',
        'challanRoyaltyNumber'
      ];
      
      requestedFields.forEach(field => {
        // Format field name
        const displayField = field
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase());
        
        const value = pdfData.tripDetails[field];
        console.log(`${displayField}: ${value !== undefined && value !== null ? value : 'N/A'}`);
      });
    } else {
      console.log('No trip details available');
    }
    
    console.log('\n--- IMAGE INFO ---');
    if (pdfData.imageInfo && Object.keys(pdfData.imageInfo).length > 0) {
      Object.keys(pdfData.imageInfo).forEach(key => {
        const value = pdfData.imageInfo[key];
        if (Array.isArray(value)) {
          console.log(`${key}: ${value.length} images`);
        } else {
          console.log(`${key}: ${value ? 'Available' : 'Not available'}`);
        }
      });
    } else {
      console.log('No image information available');
    }
    
    console.log('\n--- VERIFICATION INFO ---');
    if (pdfData.verificationInfo) {
      console.log('All Match:', pdfData.verificationInfo.allMatch);
      
      if (pdfData.verificationInfo.fieldVerifications) {
        console.log('Field Verifications:');
        Object.entries(pdfData.verificationInfo.fieldVerifications).forEach(([field, data]) => {
          console.log(`  ${field}:`);
          console.log(`    Operator: ${data.operatorValue}`);
          console.log(`    Guard: ${data.guardValue}`);
          console.log(`    Match: ${data.operatorValue === data.guardValue ? 'Yes' : 'No'}`);
          if (data.comment) {
            console.log(`    Comment: ${data.comment}`);
          }
        });
      }
    } else {
      console.log('No verification information available');
    }
    
    // Save the complete data to a JSON file for reference
    fs.writeFileSync(
      `pdf-data-${sessionId}.json`, 
      JSON.stringify(pdfData, null, 2)
    );
    console.log(`\nComplete PDF data saved to pdf-data-${sessionId}.json`);
    
  } catch (error) {
    console.error('Error fetching PDF data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Check if session ID was provided as command line argument
const sessionId = process.argv[2];

if (!sessionId) {
  console.log('Usage: node fetch-pdf-data.js <sessionId>');
  process.exit(1);
}

fetchPdfData(sessionId); 
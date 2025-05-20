const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fetchTripDetailsVerbose(sessionId) {
  try {
    console.log(`Fetching trip details for session ID: ${sessionId} (verbose mode)`);
    
    // Fetch the session basic info
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        company: {
          select: {
            name: true,
          },
        },
      },
    });

    if (!sessionData) {
      console.log('Session not found');
      return;
    }

    // Log basic session info
    console.log('\n--- BASIC SESSION INFO ---');
    console.log(`Session ID: ${sessionData.id}`);
    console.log(`Source: ${sessionData.source || 'N/A'}`);
    console.log(`Destination: ${sessionData.destination || 'N/A'}`);
    console.log(`Status: ${sessionData.status || 'N/A'}`);
    console.log(`Company: ${sessionData.company?.name || 'N/A'}`);
    
    // Fetch ALL activity logs for this session
    console.log('\nFetching ALL activity logs for this session...');
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        targetResourceId: sessionId,
        targetResourceType: 'session',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    if (activityLogs.length === 0) {
      console.log('No activity logs found for this session');
      return;
    }
    
    console.log(`Found ${activityLogs.length} activity logs`);
    
    // Process each activity log
    activityLogs.forEach((log, index) => {
      console.log(`\n=== ACTIVITY LOG #${index + 1} ===`);
      console.log(`ID: ${log.id}`);
      console.log(`Action: ${log.action}`);
      console.log(`Created At: ${log.createdAt}`);
      
      // Process details
      if (log.details) {
        let details = log.details;
        
        // Parse details if it's a string
        if (typeof details === 'string') {
          try {
            details = JSON.parse(details);
            console.log('Details (parsed from string):');
          } catch (e) {
            console.error('Failed to parse details as JSON');
            console.log('Details (raw string):', details);
            return;
          }
        } else {
          console.log('Details (object):');
        }
        
        // Check for tripDetails specifically
        if (details.tripDetails) {
          console.log('\n--- TRIP DETAILS FOUND ---');
          console.log('Keys:', Object.keys(details.tripDetails).join(', '));
          
          // Show the specific requested fields
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
          
          console.log('\nRequested Field Values:');
          requestedFields.forEach(field => {
            const displayField = field
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());
            
            const value = details.tripDetails[field];
            console.log(`${displayField}: ${value !== undefined && value !== null ? value : 'N/A'}`);
          });
        }
        
        // Print the full details structure (limited to avoid too much output for images)
        try {
          // Create a safe copy that won't have huge base64 strings
          const safeCopy = { ...details };
          
          // Handle imageBase64Data if present
          if (safeCopy.imageBase64Data) {
            safeCopy.imageBase64Data = '[BASE64_DATA_REMOVED]';
          }
          
          // Handle images if present
          if (safeCopy.images) {
            Object.keys(safeCopy.images).forEach(key => {
              const val = safeCopy.images[key];
              if (typeof val === 'string' && val.length > 100) {
                safeCopy.images[key] = `[LONG_STRING: ${val.substring(0, 50)}...]`;
              }
            });
          }
          
          console.log('\nFull Details Structure:');
          console.log(JSON.stringify(safeCopy, null, 2));
        } catch (e) {
          console.error('Error stringifying details:', e);
        }
      } else {
        console.log('No details available in this activity log');
      }
    });
    
  } catch (error) {
    console.error('Error fetching trip details:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Check if session ID was provided as command line argument
const sessionId = process.argv[2];

if (!sessionId) {
  console.log('Usage: node fetch-trip-details-verbose.js <sessionId>');
  process.exit(1);
}

fetchTripDetailsVerbose(sessionId); 
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fetchTripDetailsFromActivityLog(sessionId) {
  try {
    console.log(`Fetching trip details for session ID: ${sessionId} from ActivityLog`);
    
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
    
    // Fetch activityLog with CREATE action type for this session
    console.log('\nFetching activity log for trip details...');
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
    
    if (!activityLog) {
      console.log('No activity log found for this session');
      return;
    }
    
    console.log(`Found activity log ID: ${activityLog.id}`);
    
    // Extract trip details from the activity log
    let tripDetails = {};
    
    if (activityLog.details) {
      let details = activityLog.details;
      
      // Parse details if it's a string
      if (typeof details === 'string') {
        try {
          details = JSON.parse(details);
        } catch (e) {
          console.error('Failed to parse activity log details:', e);
        }
      }
      
      // Extract trip details from various possible locations
      if (details?.tripDetails) {
        console.log('Found tripDetails in activity log');
        tripDetails = details.tripDetails;
      } else if (details?.data?.tripDetails) {
        console.log('Found data.tripDetails in activity log');
        tripDetails = details.data.tripDetails;
      }
    }
    
    // Display trip details
    console.log('\n--- TRIP DETAILS FROM ACTIVITY LOG ---');
    if (Object.keys(tripDetails).length === 0) {
      console.log('No trip details found in activity log');
      return;
    }
    
    // Define the specific fields we want to display
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
    
    // Display the requested fields in order
    requestedFields.forEach(field => {
      // Format the field name for display (camelCase to Title Case)
      const displayField = field
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase());
      
      const value = tripDetails[field];
      console.log(`${displayField}: ${value !== undefined && value !== null ? value : 'N/A'}`);
    });
    
    // Show raw details for debugging
    console.log('\n--- RAW ACTIVITY LOG DETAILS ---');
    console.log(JSON.stringify(activityLog.details, null, 2));
    
  } catch (error) {
    console.error('Error fetching trip details:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Check if session ID was provided as command line argument
const sessionId = process.argv[2];

if (!sessionId) {
  console.log('Usage: node fetch-trip-details-activitylog.js <sessionId>');
  process.exit(1);
}

fetchTripDetailsFromActivityLog(sessionId); 
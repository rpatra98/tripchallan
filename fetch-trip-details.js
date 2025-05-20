const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fetchTripDetails(sessionId) {
  try {
    console.log(`Fetching trip details for session ID: ${sessionId}`);
    
    // Fetch the session with all related data
    const sessionData = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        company: {
          select: {
            id: true,
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
    
    // Get trip details from all possible sources
    let allTripFields = {};
    
    // 1. First try sessionData.tripDetails if it exists
    if (sessionData.tripDetails && typeof sessionData.tripDetails === 'object') {
      console.log("\nFound tripDetails object in session");
      allTripFields = {...allTripFields, ...sessionData.tripDetails};
    }
    
    // 2. Look for direct fields on sessionData
    const directTripFieldNames = [
      'vehicleNumber', 'driverName', 'driverContactNumber', 'freight', 
      'transporterName', 'materialName', 'gpsImeiNumber', 'challanRoyaltyNumber',
      'doNumber', 'tpNumber', 'grossWeight', 'tareWeight', 'loadingSite',
      'receiverPartyName', 'loaderName', 'loaderMobileNumber', 'qualityOfMaterials',
      'netMaterialWeight'
    ];
    
    for (const field of directTripFieldNames) {
      if (sessionData[field] !== undefined && sessionData[field] !== null) {
        allTripFields[field] = sessionData[field];
      }
    }
    
    // 3. Try to extract from activityLog if it exists
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
      let detailsData = activityLog.details;
      
      if (typeof detailsData === 'string') {
        try {
          detailsData = JSON.parse(detailsData);
        } catch (e) {
          console.error("Failed to parse activityLog.details string");
        }
      }
      
      // Check multiple possible locations in the details object
      if (detailsData) {
        // Direct tripDetails object
        if (detailsData.tripDetails && typeof detailsData.tripDetails === 'object') {
          console.log("Found tripDetails in activity log");
          allTripFields = {...allTripFields, ...detailsData.tripDetails};
        }
        
        // Nested in data.tripDetails
        if (detailsData.data?.tripDetails && typeof detailsData.data.tripDetails === 'object') {
          console.log("Found data.tripDetails in activity log");
          allTripFields = {...allTripFields, ...detailsData.data.tripDetails};
        }
        
        // Direct in data object
        if (detailsData.data && typeof detailsData.data === 'object') {
          for (const field of directTripFieldNames) {
            if (detailsData.data[field] !== undefined) {
              allTripFields[field] = detailsData.data[field];
            }
          }
        }
      }
    }
    
    // Display the requested trip detail fields
    console.log('\n--- TRIP DETAILS ---');
    
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
    
    let foundAnyField = false;
    
    for (const field of requestedFields) {
      // Convert camelCase to Title Case for display
      const displayField = field
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase());
        
      const value = allTripFields[field];
      console.log(`${displayField}: ${value !== undefined && value !== null ? value : 'N/A'}`);
      
      if (value !== undefined && value !== null) {
        foundAnyField = true;
      }
    }
    
    if (!foundAnyField) {
      console.log('No trip details found for this session');
    }
    
  } catch (error) {
    console.error('Error fetching trip details:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Check if session ID was provided as command line argument
const sessionId = process.argv[2];

if (!sessionId) {
  console.log('Usage: node fetch-trip-details.js <sessionId>');
  process.exit(1);
}

fetchTripDetails(sessionId); 
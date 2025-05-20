const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getMoreSessions() {
  try {
    // Get sessions from various companies
    const sessions = await prisma.session.findMany({
      select: {
        id: true,
        source: true,
        destination: true,
        status: true,
        createdAt: true,
        company: {
          select: {
            name: true
          }
        },
        tripDetails: true
      },
      where: {
        OR: [
          { tripDetails: { not: null } },
          { tripDetails: { not: {} } }
        ]
      },
      take: 10,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`Found ${sessions.length} sessions with potential trip details:`);
    sessions.forEach((session, index) => {
      const hasTripDetails = session.tripDetails && 
                           Object.keys(session.tripDetails).length > 0 ? 
                           'YES' : 'NO';
      
      console.log(`\n${index + 1}. ID: ${session.id}`);
      console.log(`   Company: ${session.company?.name || 'N/A'}`);
      console.log(`   Status: ${session.status} | Created: ${session.createdAt}`);
      console.log(`   Source: ${session.source} -> Destination: ${session.destination}`);
      console.log(`   Has Trip Details: ${hasTripDetails}`);
      
      if (hasTripDetails === 'YES') {
        console.log(`   Trip Detail Fields: ${Object.keys(session.tripDetails).join(', ')}`);
      }
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getMoreSessions(); 
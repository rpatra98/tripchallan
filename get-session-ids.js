const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getSessionIds() {
  try {
    const sessions = await prisma.session.findMany({
      select: {
        id: true,
        source: true,
        destination: true,
        status: true,
        createdAt: true
      },
      take: 5,
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log('Recent Sessions:');
    sessions.forEach((session, index) => {
      console.log(`${index + 1}. ID: ${session.id} | Status: ${session.status} | Created: ${session.createdAt}`);
      console.log(`   Source: ${session.source} -> Destination: ${session.destination}`);
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

getSessionIds(); 
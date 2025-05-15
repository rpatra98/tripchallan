const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function generateTestLogs() {
  try {
    // First, get a user to attach the logs to
    const adminUser = await prisma.user.findFirst({
      where: { role: 'ADMIN' }
    });

    if (!adminUser) {
      console.error("No admin user found. Please create a user first.");
      return;
    }

    // Create some sample activity logs
    const activityTypes = [
      { action: 'CREATE', targetResourceType: 'USER', details: { userName: 'Test User', userRole: 'EMPLOYEE' } },
      { action: 'UPDATE', targetResourceType: 'COMPANY', details: { companyName: 'Test Company', updatedFields: ['name', 'address'] } },
      { action: 'VIEW', targetResourceType: 'USER_LIST', details: { resultCount: 10, totalCount: 50 } },
      { action: 'LOGIN', targetResourceType: 'SESSION', details: { device: 'desktop', sessionId: 'test-session-123' } },
      { action: 'LOGOUT', targetResourceType: 'SESSION', details: { device: 'mobile', sessionId: 'test-session-456' } }
    ];

    const createdLogs = [];

    for (const activity of activityTypes) {
      const log = await prisma.activityLog.create({
        data: {
          userId: adminUser.id,
          action: activity.action,
          targetResourceType: activity.targetResourceType,
          targetResourceId: `test-resource-${Date.now()}`,
          details: activity.details,
          userAgent: activity.action === 'LOGIN' ? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124' : undefined
        }
      });

      createdLogs.push(log);
      console.log(`Created activity log: ${log.id} - ${log.action}`);
    }

    console.log(`Successfully created ${createdLogs.length} activity logs`);
  } catch (error) {
    console.error('Error generating test logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

generateTestLogs(); 
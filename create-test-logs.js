const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestLogs() {
  try {
    console.log('Checking if any activity logs exist...');
    const logCount = await prisma.activityLog.count();
    console.log(`Found ${logCount} activity logs in the database`);

    if (logCount === 0) {
      // Find a user to associate with the logs
      console.log('Finding a user to associate with test logs...');
      const user = await prisma.user.findFirst();
      
      if (!user) {
        console.error('No users found in the database. Cannot create test logs.');
        return;
      }
      
      console.log(`Using user: ${user.name} (${user.id}) to create test logs`);
      
      // Create sample activity logs
      const testLogs = [
        // Login activity
        {
          userId: user.id,
          action: 'LOGIN',
          details: { device: 'desktop' },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        // Create user activity
        {
          userId: user.id,
          action: 'CREATE',
          targetResourceType: 'USER',
          targetResourceId: 'test-user-123',
          details: { 
            userName: 'Test User', 
            userEmail: 'test@example.com',
            userRole: 'EMPLOYEE' 
          }
        },
        // View activity
        {
          userId: user.id,
          action: 'VIEW',
          targetResourceType: 'USER_LIST',
          details: { 
            filters: { role: 'EMPLOYEE' },
            resultCount: 10
          }
        },
        // Update activity
        {
          userId: user.id,
          action: 'UPDATE',
          targetResourceType: 'USER',
          targetResourceId: 'test-user-456',
          details: { 
            userName: 'Updated User', 
            summaryText: 'Updated user profile information' 
          }
        },
        // Transaction activity
        {
          userId: user.id,
          action: 'ALLOCATE',
          targetResourceType: 'COINS',
          targetResourceId: 'transaction-123',
          details: { 
            amount: 100, 
            recipientName: 'Test User' 
          }
        }
      ];
      
      console.log('Creating test activity logs...');
      
      for (const logData of testLogs) {
        await prisma.activityLog.create({ data: logData });
        console.log(`Created activity log: ${logData.action}`);
      }
      
      console.log('Successfully created test activity logs');
    } else {
      console.log('Activity logs already exist in the database. No test data created.');
    }
  } catch (error) {
    console.error('Error creating test logs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestLogs(); 
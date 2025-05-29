import prisma from './prisma';

// Create a single PrismaClient instance for all helpers
let hasDisconnectedOnce = false;

/**
 * Execute a Prisma query with automatic retry on prepared statement errors
 * @param operation Function that performs the Prisma operation
 * @returns Result of the operation
 */
export async function executePrismaWithRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    // If we've had connection issues before, reconnect first
    if (hasDisconnectedOnce) {
      try {
        await prisma.$disconnect();
        await prisma.$connect();
      } catch (connErr) {
        console.error('Error during reconnect:', connErr);
        // Continue even if reconnect fails
      }
    }
    
    return await operation();
  } catch (error: any) {
    // Check if this is a prepared statement error
    if (
      error.message && 
      (error.message.includes('prepared statement') || 
       (error.code === '42P05'))
    ) {
      console.warn('Prepared statement error detected, retrying with new connection');
      hasDisconnectedOnce = true;
      
      // Try to fix the connection
      try {
        await prisma.$disconnect();
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms
        await prisma.$connect();
        
        // Try once more
        return await operation();
      } catch (retryError: any) {
        // If we still get a prepared statement error, try one more time with delay
        if (
          retryError.message && 
          (retryError.message.includes('prepared statement') || 
           (retryError.code === '42P05'))
        ) {
          console.warn('Still getting prepared statement error, trying final reconnect');
          
          try {
            await prisma.$disconnect();
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
            await prisma.$connect();
            return await operation();
          } catch (finalError) {
            console.error('Error on final retry:', finalError);
            throw finalError;
          }
        }
        
        console.error('Error on retry after prepared statement issue:', retryError);
        throw retryError;
      }
    }
    
    // If it's not a prepared statement error, just rethrow
    throw error;
  }
}

/**
 * Safely finds a company by ID with retry logic for prepared statement errors
 */
export async function findCompanyById(id: string, includeEmployees = true) {
  return executePrismaWithRetry(async () => {
    return prisma.company.findUnique({
      where: { id },
      include: includeEmployees ? {
        employees: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            subrole: true,
            coins: true,
          }
        }
      } : undefined
    });
  });
}

/**
 * Safely finds a user by ID with retry logic for prepared statement errors
 */
export async function findUserById(id: string) {
  return executePrismaWithRetry(async () => {
    return prisma.user.findUnique({
      where: { id }
    });
  });
}

/**
 * Safely finds users with specific criteria and retry logic for prepared statement errors
 */
export async function findUsers(criteria: any, select?: any) {
  return executePrismaWithRetry(async () => {
    return prisma.user.findMany({
      where: criteria,
      ...(select ? { select } : {})
    });
  });
}

/**
 * Safely finds first user with specific criteria and retry logic for prepared statement errors
 */
export async function findFirstUser(criteria: any, select?: any) {
  return executePrismaWithRetry(async () => {
    return prisma.user.findFirst({
      where: criteria,
      ...(select ? { select } : {})
    });
  });
}

// Reset connection if we get the prepared statement error
export async function resetConnection() {
  try {
    await prisma.$disconnect();
    await new Promise(resolve => setTimeout(resolve, 1000));
    await prisma.$connect();
  } catch (error) {
    console.error('Error resetting Prisma connection:', error);
  }
}

export default {
  executePrismaWithRetry,
  findCompanyById,
  findUserById,
  findUsers,
  findFirstUser,
  resetConnection
}; 
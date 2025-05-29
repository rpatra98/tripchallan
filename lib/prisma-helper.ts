import prisma from './prisma';

// Create a single PrismaClient instance for all helpers
let hasDisconnectedOnce = false;
let lastReconnectTime = 0;

/**
 * Execute a Prisma query with automatic retry on prepared statement errors
 * @param operation Function that performs the Prisma operation
 * @returns Result of the operation
 */
export async function executePrismaWithRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    // If we've had connection issues before or it's been more than 30 seconds since reconnect,
    // reset the connection proactively
    const currentTime = Date.now();
    const reconnectInterval = 30 * 1000; // 30 seconds
    
    if (hasDisconnectedOnce || (currentTime - lastReconnectTime > reconnectInterval)) {
      await resetConnection();
      lastReconnectTime = currentTime;
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
        await resetConnection();
        
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
            await resetConnection(2000); // Longer wait on second retry
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

/**
 * Completely resets the Prisma connection to resolve prepared statement issues
 * @param delayMs Optional delay before reconnecting (in milliseconds)
 */
export async function resetConnection(delayMs = 1000) {
  console.log(`Resetting Prisma connection with ${delayMs}ms delay`);
  try {
    // First disconnect
    await prisma.$disconnect();
    
    // Wait for the specified delay
    if (delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
    
    // Then reconnect
    await prisma.$connect();
    console.log('Prisma connection reset successful');
  } catch (error) {
    console.error('Error resetting Prisma connection:', error);
    // If reconnection fails, we need to ensure we still attempt to reconnect next time
    hasDisconnectedOnce = true;
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